// ─────────────────────────────────────────────────────────────────────────────
// review.controller.js — business logic for GET /api/review
//
// Called by: ReviewQueuePage.tsx on load + every 20 seconds (auto-refresh)
//
// A "controller" receives req (request) and res (response), talks to MongoDB,
// then sends JSON back to the React app.
// ─────────────────────────────────────────────────────────────────────────────

import Story from "../../models/Story.model.js";
import Client from "../../models/Client.model.js";
import * as storyService from "../../services/story/story.service.js";
import { resolveWorkspaceContext } from "../../utils/workspaceContext.js";
import { buildWorkspaceStoryFilter } from "../../utils/workspaceStoryFilter.js";

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

  return {
    id,
    ticketId: `DP-${id.slice(-4).toUpperCase()}`,
    storyTitle: doc.storyTitle ?? doc.title,
    title: doc.storyTitle ?? doc.title,
    description: doc.description ?? "",
    type: mapTypeToUi(doc.type),
    priority: doc.priority ?? "Medium",
    source: mapSourceToUi(doc.source),
    sourceQuote: doc.sourceQuote ?? "",
    acceptanceCriteria: doc.acceptanceCriteria ?? [],
    acceptanceCriteriaFormatted: doc.acceptanceCriteriaFormatted ?? [],
    releaseNotes: doc.releaseNotes ?? "",
    client: clientName,
    clientId:
      client && typeof client === "object"
        ? client._id.toString()
        : doc.clientId?.toString(),
    sprint: doc.sprint ?? "Backlog",
    status: "pending",
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

    const wsContext = await resolveWorkspaceContext(req, organisationId);

    // Dual-filter: stories saved with this org's ID  OR  stories whose clientId
    // belongs to a client in this org. The clientId fallback catches stories
    // created under a previous organisationId when an account was recreated
    // (same pattern as the Slack messages fix).
    const orgClients = await Client.find({ organisationId }).select("_id").lean();
    const orgClientIds = orgClients.map((c) => c._id);

    const baseFilter =
      orgClientIds.length > 0
        ? { $or: [{ organisationId }, { clientId: { $in: orgClientIds } }] }
        : { organisationId };

    const storyFilter = { ...baseFilter, status: "pending-review" };

    console.log("[reviewQueue] org:", organisationId, "| clients:", orgClientIds.length);

    // Multi-workspace: when x-workspace-id is set, narrow to that Slack team's clients
    if (wsContext.teamId) {
      const workspaceClause = await buildWorkspaceStoryFilter(
        organisationId,
        wsContext.teamId,
      );
      Object.assign(storyFilter, workspaceClause);
    }

    const stories = await Story.find(storyFilter)
      .sort({ createdAt: -1 })
      .populate("clientId", "name company organisationId");

    console.log("[reviewQueue] found:", stories.length, "pending stories");

    // Defensive: exclude any story whose populated client belongs to a different org
    const safeStories = stories.filter((s) => {
      const clientOrg =
        s.clientId &&
        typeof s.clientId === "object" &&
        s.clientId.organisationId?.toString();
      return !clientOrg || clientOrg === organisationId.toString();
    });

    // Stats for the top bar (Pending / Approved Today / Rejected) — same workspace scope
    const stats = await storyService.getReviewQueueStats(
      organisationId,
      wsContext.teamId,
    );

    return res.status(200).json({
      success: true,
      stories: safeStories.map(toReviewStoryDto),
      stats,
      workspace: wsContext.workspace
        ? {
            id: wsContext.workspace._id.toString(),
            teamName: wsContext.workspace.teamName,
            displayName: `${wsContext.workspace.teamName} Workspace`,
          }
        : null,
    });
  } catch (error) {
    console.error("[review] getReviewQueue:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to load review queue",
    });
  }
}
