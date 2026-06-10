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
import SlackWorkspace from "../../models/SlackWorkspace.model.js";
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

    // Collect every organisationId linked to an active workspace so stories
    // saved under a previous org (reconnected workspace) are still visible.
    const activeWorkspaces = await SlackWorkspace.find({ isActive: true })
      .select("organisationId")
      .lean();

    const orgIds = [
      ...new Set([
        organisationId.toString(),
        ...activeWorkspaces
          .map((w) => w.organisationId?.toString())
          .filter(Boolean),
      ]),
    ];

    console.log("[reviewQueue] user org:", organisationId, "| searching orgIds:", orgIds);

    const storyFilter = {
      status: "pending-review",
      organisationId: { $in: orgIds },
    };

    const stories = await Story.find(storyFilter)
      .populate("clientId", "name company organisationId")
      .sort({ createdAt: -1 })
      .limit(100);

    console.log("[reviewQueue] found:", stories.length, "pending stories");

    const stats = {
      pending: stories.length,
      approvedToday: 0,
      rejected: 0,
      edited: 0,
    };

    return res.status(200).json({
      success: true,
      stories: stories.map(toReviewStoryDto),
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
