// ─────────────────────────────────────────────────────────────────────────────
// review.controller.js — business logic for GET /api/review
//
// Called by: ReviewQueuePage.tsx on load + every 20 seconds (auto-refresh)
//
// A "controller" receives req (request) and res (response), talks to MongoDB,
// then sends JSON back to the React app.
// ─────────────────────────────────────────────────────────────────────────────

import Story from "../../models/Story.model.js";
import SlackWorkspace from "../../models/SlackWorkspace.model.js";

// ── Helpers: shape MongoDB documents for the React UI ───────────────────────

function formatTimeAgo(date) {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapSourceToUi(source) {
  if (source === "document") return "doc";
  if (source === "meeting") return "meeting";
  return "slack";
}

function mapTypeToUi(type) {
  const t = (type ?? "Story").toLowerCase();
  if (t === "bug") return "bug";
  if (t === "feature") return "feature";
  if (t === "task") return "task";
  return "story";
}

/** Convert one MongoDB story document → JSON the Review Queue cards expect */
export function toReviewStoryDto(doc) {
  const client = doc.clientId;
  const clientName =
    client && typeof client === "object" && client.name
      ? client.name
      : "Unknown client";

  const id = doc._id.toString();

  // Normalise type to Title Case so frontend typeColors map works for both
  // DTO stories (review tabs) and raw MongoDB stories (ADO tab).
  const typeMap = { bug: "Bug", story: "Story", feature: "Feature", task: "Task" };
  const rawType = (doc.type ?? "Story");
  const normalisedType = typeMap[rawType.toLowerCase()] ?? rawType;

  return {
    _id: id,
    id,
    ticketId: `DP-${id.slice(-4).toUpperCase()}`,
    storyTitle: doc.storyTitle ?? doc.title,
    title: doc.storyTitle ?? doc.title,
    description: doc.description ?? "",
    type: normalisedType,
    priority: doc.priority ?? "Medium",
    source: doc.source ?? "slack",
    sourceQuote: doc.sourceQuote ?? "",
    acceptanceCriteria: doc.acceptanceCriteria ?? [],
    acceptanceCriteriaFormatted: doc.acceptanceCriteriaFormatted ?? [],
    releaseNotes: doc.releaseNotes ?? "",
    client: clientName,
    // Return clientId as object so frontend can use clientId?.name directly
    clientId: client && typeof client === "object"
      ? { _id: client._id?.toString(), name: client.name, company: client.company }
      : null,
    projectId: doc.projectId && typeof doc.projectId === "object"
      ? { _id: doc.projectId._id?.toString(), name: doc.projectId.name, color: doc.projectId.color }
      : null,
    sprint: doc.sprint ?? "Backlog",
    status: doc.status ?? "pending-review",
    createdAt: doc.createdAt,
    approvedAt: doc.approvedAt,
    updatedAt: doc.updatedAt,
    adoId: doc.adoId ?? null,
    timeAgo: formatTimeAgo(doc.createdAt),
    regressionWarning: doc.regressionOf
      ? "Possible regression of a prior story"
      : undefined,
    isAIGenerated: doc.isAIGenerated ?? true,
  };
}

/**
 * getReviewQueue — GET /api/review
 *
 * Steps:
 *   1. Read organisationId from JWT (req.user) so users only see their org's data
 *   2. Find stories with status "pending-review"
 *   3. Populate clientId → attach client name + company to each story
 *   4. Sort newest first (createdAt descending)
 *   5. Return { stories: [...] } for ReviewQueuePage cards + stats for header bar
 */
export async function getReviewQueue(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;

    if (!organisationId) {
      return res.status(400).json({
        success: false,
        message: "Organisation not found in session",
      });
    }

    const { source, projectId } = req.query;

    // Sweep all active workspace org IDs so stories saved under a previously
    // linked org are still visible (account-recreate / reconnect scenario).
    const activeWorkspaces = await SlackWorkspace.find({ isActive: true })
      .select("organisationId")
      .lean();

    const orgIds = [
      ...new Set([
        organisationId.toString(),
        ...activeWorkspaces.map((w) => w.organisationId?.toString()).filter(Boolean),
      ]),
    ];

    console.log("[reviewQueue] user org:", organisationId, "| orgIds:", orgIds, "| source:", source ?? "all");

    const storyFilter = {
      status: "pending-review",
      organisationId: { $in: orgIds },
    };
    if (source) storyFilter.source = source;
    if (projectId) storyFilter.projectId = projectId;

    const stories = await Story.find(storyFilter)
      .populate("clientId", "name company")
      .populate("projectId", "name color")
      .sort({ createdAt: -1 })
      .limit(100);

    console.log("[reviewQueue] found:", stories.length, "stories");

    const stats = {
      pending: stories.length,
      approvedToday: 0,
      rejected: 0,
      edited: 0,
    };

    return res.status(200).json({
      success: true,
      data: stories.map(toReviewStoryDto),
      // legacy key — some clients still read stories
      stories: stories.map(toReviewStoryDto),
      stats,
      workspace: null,
    });
  } catch (error) {
    console.error("[review] getReviewQueue:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to load review queue",
    });
  }
}
