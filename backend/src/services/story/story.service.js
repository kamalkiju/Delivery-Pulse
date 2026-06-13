// ─────────────────────────────────────────────────────────────────────────────
// story.service.js — create and manage stories in MongoDB
//
// Frontend mapping:
//   createDraftStory  → Slack bot (automatic); result shows on ReviewQueuePage
//   getPendingStories → ReviewQueuePage.tsx (GET /api/review)
//   approveStory      → ReviewQueuePage “Approve” (PATCH /api/stories/:id/approve)
//   rejectStory       → ReviewQueuePage “Reject” (PATCH /api/stories/:id/reject)
// ─────────────────────────────────────────────────────────────────────────────

import Story from "../../models/Story.model.js";
import Client from "../../models/Client.model.js";
import User from "../../models/User.model.js";
import adoService from "../ado/ado.service.js";
import teamsService from "../teams/teams.service.js";
import { buildWorkspaceStoryFilter } from "../../utils/workspaceStoryFilter.js";

/**
 * Build a safe regex from the AI title to find “similar” existing stories.
 * Uses the first few meaningful words so small wording changes still match.
 */
function buildSimilarTitleRegex(title) {
  const words = (title ?? "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (words.length > 0) {
    return new RegExp(words.join("|"), "i");
  }

  const escaped = (title ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.slice(0, 40), "i");
}

/**
 * createDraftStory — save AI output as a draft for BA review.
 *
 * Used by: slack.service.js after Claude analysis.
 * Appears on: ReviewQueuePage once GET /api/review is wired.
 */
export async function createDraftStory({
  aiResult,
  organisationId,
  clientId,
  sourceRef,
  sourceQuote,
}) {
  const client = await Client.findById(clientId);
  if (!client || client.organisationId.toString() !== organisationId.toString()) {
    const err = new Error("Client not found for this organisation");
    err.statusCode = 404;
    throw err;
  }

  // Step 1 — Regression detection: same client reporting a similar issue again?
  const existingStory = await Story.findOne({
    organisationId,
    clientId,
    title: { $regex: buildSimilarTitleRegex(aiResult.title) },
    status: { $ne: "rejected" },
  });

  // Step 2 — Create new story (pending-review → Review Queue)
  const story = await Story.create({
    organisationId,
    clientId,
    storyTitle: aiResult.storyTitle ?? aiResult.title,
    title: aiResult.storyTitle ?? aiResult.title,
    description: aiResult.description,
    descriptionStatement: aiResult.description,
    type: aiResult.type ?? "Story",
    priority: aiResult.priority ?? "Medium",
    status: "pending-review",
    acceptanceCriteria: (aiResult.acceptanceCriteria || [])
      .map((ac) => (typeof ac === "string" ? ac : ac.scenario || ""))
      .filter(Boolean),
    acceptanceCriteriaFormatted: (aiResult.acceptanceCriteriaFormatted || [])
      .map((ac, i) => ({
        id: ac.id || `AC ${i + 1}`,
        scenario: typeof ac === "string" ? ac : ac.scenario || "",
      }))
      .filter((ac) => ac.scenario),
    releaseNotes: aiResult.releaseNotes ?? "",
    businessRequirement: aiResult.businessRequirement ?? "",
    userFlow: aiResult.userFlow ?? "",
    uiBehavior: aiResult.uiBehavior ?? "",
    validations: aiResult.validations ?? [],
    tags: Array.isArray(aiResult.tags) ? aiResult.tags : [],
    source: "slack",
    sourceRef: sourceRef.toString(),
    sourceQuote,
    isAIGenerated: true,
    regressionOf: existingStory ? existingStory._id : null,
    sprint: aiResult.suggestedSprint,
  });

  return story;
}

/**
 * approveStory — BA approves a draft → ADO → Teams notify.
 *
 * Used by: ReviewQueuePage.tsx approve action.
 */
export async function approveStory(storyId, approvedById) {
  const approver = await User.findById(approvedById);
  if (!approver) {
    const err = new Error("Approver user not found");
    err.statusCode = 404;
    throw err;
  }

  // Step 1 — Mark approved in MongoDB
  let story = await Story.findByIdAndUpdate(
    storyId,
    {
      status: "approved",
      approvedBy: approvedById,
      approvedAt: new Date(),
    },
    { new: true },
  );

  if (!story) {
    const err = new Error("Story not found");
    err.statusCode = 404;
    throw err;
  }

  // Step 2 — Push to Azure DevOps
  const adoId = await adoService.createWorkItem(story);

  // Step 3 — Store ADO id and move to pushed-to-ado
  story = await Story.findByIdAndUpdate(
    storyId,
    {
      adoId,
      status: "pushed-to-ado",
    },
    { new: true },
  ).populate("clientId", "name company");

  // Step 4 — Notify assigned developer in Teams
  await teamsService.notifyDeveloper(story);

  return story;
}

/**
 * rejectStory — BA dismisses a draft (hidden from pending queue).
 *
 * Used by: ReviewQueuePage.tsx reject action.
 */
export async function rejectStory(storyId) {
  const story = await Story.findByIdAndUpdate(
    storyId,
    { status: "rejected" },
    { new: true },
  );

  if (!story) {
    const err = new Error("Story not found");
    err.statusCode = 404;
    throw err;
  }

  return story;
}

/**
 * getPendingStories — list drafts waiting for BA sign-off.
 *
 * Used by: ReviewQueuePage.tsx (GET /api/review).
 */
export async function getPendingStories(organisationId) {
  return Story.find({
    organisationId,
    status: "pending-review",
  })
    .sort({ createdAt: -1 })
    .populate("clientId", "name company");
}

/** Stats for ReviewQueuePage header pills — optional teamId scopes to one workspace */
export async function getReviewQueueStats(organisationId, teamId = null) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const workspaceClause = teamId
    ? await buildWorkspaceStoryFilter(organisationId, teamId)
    : {};

  // Same dual-filter as getReviewQueue: match by organisationId OR by client ownership
  const orgClients = await Client.find({ organisationId }).select("_id").lean();
  const orgClientIds = orgClients.map((c) => c._id);

  const orgClause =
    orgClientIds.length > 0
      ? { $or: [{ organisationId }, { clientId: { $in: orgClientIds } }] }
      : { organisationId };

  const base = { ...orgClause, ...workspaceClause };

  const [pending, approvedToday, rejected] = await Promise.all([
    Story.countDocuments({ ...base, status: "pending-review" }),
    Story.countDocuments({
      ...base,
      status: { $in: ["approved", "pushed-to-ado", "done"] },
      approvedAt: { $gte: startOfToday },
    }),
    Story.countDocuments({ ...base, status: "rejected" }),
  ]);

  return { pending, approvedToday, rejected, edited: 0 };
}

/**
 * updateStory — BA edits fields before approve (ReviewQueuePage edit panel).
 */
export async function updateStory(storyId, updates = {}) {
  const patch = {};

  if (updates.storyTitle != null) {
    patch.storyTitle = updates.storyTitle;
    patch.title = updates.storyTitle;
  }
  if (updates.title != null && updates.storyTitle == null) patch.title = updates.title;
  if (updates.description != null) patch.description = updates.description;
  if (updates.type != null) {
    const typeMap = {
      bug: "Bug",
      story: "Story",
      task: "Task",
      feature: "Feature",
    };
    const key = String(updates.type).toLowerCase();
    patch.type = typeMap[key] ?? updates.type;
  }
  if (updates.priority != null) patch.priority = updates.priority;
  if (updates.acceptanceCriteria != null) {
    patch.acceptanceCriteria = updates.acceptanceCriteria;
  }
  if (updates.acceptanceCriteriaFormatted != null) {
    patch.acceptanceCriteriaFormatted = updates.acceptanceCriteriaFormatted;
  }
  if (updates.releaseNotes != null) patch.releaseNotes = updates.releaseNotes;
  if (updates.sprint != null) patch.sprint = updates.sprint;
  if (updates.assignee != null) patch.assignee = updates.assignee;
  if (updates.assigneeName != null) patch.assigneeName = updates.assigneeName;
  if (updates.areaPath != null) patch.areaPath = updates.areaPath;
  if (updates.tags != null) patch.tags = updates.tags;
  if (updates.figmaLink != null) patch.figmaLink = updates.figmaLink;
  if (updates.userFlow != null) patch.userFlow = updates.userFlow;
  if (updates.uiBehavior != null) patch.uiBehavior = updates.uiBehavior;
  if (updates.businessRequirement != null) patch.businessRequirement = updates.businessRequirement;
  if (updates.validations != null) patch.validations = updates.validations;

  const story = await Story.findByIdAndUpdate(storyId, patch, {
    new: true,
  }).populate("clientId", "name company");

  if (!story) {
    const err = new Error("Story not found");
    err.statusCode = 404;
    throw err;
  }

  return story;
}

export default {
  createDraftStory,
  approveStory,
  rejectStory,
  getPendingStories,
  getReviewQueueStats,
  updateStory,
};
