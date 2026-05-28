// dashboard.service.js — aggregates real data for DashboardPage (org + optional workspace)

import Client from "../../models/Client.model.js";
import Story from "../../models/Story.model.js";
import SlackMessage from "../../models/SlackMessage.model.js";
import SlackChannel from "../../models/SlackChannel.model.js";
import Commitment from "../../models/Commitment.model.js";
import { buildWorkspaceStoryFilter } from "../../utils/workspaceStoryFilter.js";

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

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Client ids linked to mapped channels in the selected Slack workspace */
async function getWorkspaceClientIds(organisationId, workspaceMongoId, teamId) {
  const fromChannels = await SlackChannel.find({
    workspaceId: workspaceMongoId,
    isClientChannel: true,
    clientId: { $ne: null },
  }).distinct("clientId");

  const fromMessages = await SlackMessage.find({
    organisationId,
    teamId,
    clientId: { $ne: null },
  }).distinct("clientId");

  const ids = [...fromChannels, ...fromMessages].map((id) => id.toString());
  return [...new Set(ids)];
}

/** KPI row — clients, stories this week, avg health, SLA at risk */
export async function getDashboardStats(organisationId, workspaceContext = {}) {
  const { teamId, workspaceId } = workspaceContext;

  let clientFilter = { organisationId };
  let storyBase = { organisationId };

  if (teamId && workspaceId) {
    const clientIds = await getWorkspaceClientIds(
      organisationId,
      workspaceId,
      teamId,
    );
    if (clientIds.length === 0) {
      return {
        activeClients: 0,
        storiesThisWeek: 0,
        aiStoriesThisWeek: 0,
        avgHealthScore: 0,
        slaAtRisk: 0,
      };
    }
    clientFilter._id = { $in: clientIds };
    storyBase = {
      organisationId,
      ...(await buildWorkspaceStoryFilter(organisationId, teamId)),
    };
  }

  const clients = await Client.find(clientFilter).lean();

  const weekStart = startOfWeek();
  const storiesThisWeek = await Story.countDocuments({
    ...storyBase,
    createdAt: { $gte: weekStart },
  });

  const aiStoriesThisWeek = await Story.countDocuments({
    ...storyBase,
    createdAt: { $gte: weekStart },
    isAIGenerated: true,
  });

  const activeClients = clients.length;
  const avgHealthScore =
    activeClients > 0
      ? Math.round(
          clients.reduce((sum, c) => sum + (c.healthScore ?? 0), 0) /
            activeClients,
        )
      : 0;

  const slaAtRisk = clients.filter(
    (c) => c.status === "at-risk" || c.status === "critical",
  ).length;

  return {
    activeClients,
    storiesThisWeek,
    aiStoriesThisWeek,
    avgHealthScore,
    slaAtRisk,
  };
}

/** Client health table rows — scoped to workspace clients when header present */
export async function getClientHealthList(organisationId, workspaceContext = {}) {
  const { teamId, workspaceId } = workspaceContext;

  let clientFilter = { organisationId };

  if (teamId && workspaceId) {
    const clientIds = await getWorkspaceClientIds(
      organisationId,
      workspaceId,
      teamId,
    );
    if (clientIds.length === 0) return [];
    clientFilter._id = { $in: clientIds };
  }

  const clients = await Client.find(clientFilter)
    .sort({ healthScore: -1 })
    .lean();

  return clients.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    score: c.healthScore ?? 0,
    status: c.status ?? "healthy",
    lastActivity: formatTimeAgo(c.lastActivity),
  }));
}

/** AI activity feed from slackmessages — filtered by teamId when workspace selected */
export async function getAIActivityFeed(
  organisationId,
  workspaceContext = {},
  limit = 10,
) {
  const { teamId } = workspaceContext;

  const messageFilter = { organisationId };
  if (teamId) {
    messageFilter.teamId = teamId;
  }

  const messages = await SlackMessage.find(messageFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("clientId", "name")
    .populate("storyId", "title status")
    .lean();

  return messages.map((msg) => {
    const clientName =
      msg.clientId && typeof msg.clientId === "object"
        ? msg.clientId.name
        : "Unknown client";

    let description = "";
    let type = "message";

    if (msg.aiProcessed && msg.storyId) {
      type = "story";
      const storyTitle =
        typeof msg.storyId === "object" ? msg.storyId.title : "story";
      description = `Auto-created story from Slack for ${clientName}: ${storyTitle}`;
    } else if (msg.hasImage) {
      type = "screenshot";
      description = `Screenshot received from ${clientName} in ${msg.channelName ?? "Slack"}`;
    } else {
      const preview =
        (msg.messageText ?? "").length > 80
          ? `${msg.messageText.slice(0, 80)}…`
          : msg.messageText ?? "(no text)";
      description = msg.isExternal
        ? `Client message from ${clientName}: ${preview}`
        : `Message in ${msg.channelName ?? clientName}: ${preview}`;
    }

    return {
      id: msg._id.toString(),
      type,
      description,
      time: formatTimeAgo(msg.createdAt),
      isExternal: msg.isExternal ?? false,
      aiProcessed: msg.aiProcessed ?? false,
    };
  });
}

/** Sprint health from stories — workspace-scoped when teamId provided */
export async function getSprintHealth(organisationId, workspaceContext = {}) {
  const { teamId } = workspaceContext;

  let storyFilter = { organisationId };
  if (teamId) {
    storyFilter = {
      organisationId,
      ...(await buildWorkspaceStoryFilter(organisationId, teamId)),
    };
  }

  const stories = await Story.find(storyFilter).lean();

  const buckets = new Map();

  for (const story of stories) {
    const sprintName = story.sprint?.trim() || "Backlog";

    if (!buckets.has(sprintName)) {
      buckets.set(sprintName, {
        name: sprintName,
        total: 0,
        done: 0,
        inReview: 0,
        inProgress: 0,
        atRisk: 0,
      });
    }

    const bucket = buckets.get(sprintName);
    bucket.total += 1;

    if (story.status === "done" || story.status === "pushed-to-ado") {
      bucket.done += 1;
    } else if (story.status === "pending-review") {
      bucket.inReview += 1;
    } else if (story.status === "approved") {
      bucket.inProgress += 1;
    }

    if (
      (story.priority === "Critical" || story.priority === "High") &&
      story.status !== "done" &&
      story.status !== "pushed-to-ado"
    ) {
      bucket.atRisk += 1;
    }
  }

  const sprintOrder = (name) => {
    if (/current/i.test(name)) return 0;
    if (/next/i.test(name)) return 1;
    if (/sprint\s*(\d+)/i.test(name)) {
      return 10 + parseInt(name.match(/sprint\s*(\d+)/i)[1], 10);
    }
    if (/backlog/i.test(name)) return 1000;
    return 500;
  };

  return Array.from(buckets.values())
    .map((s) => {
      const progressPercent =
        s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      let health = "healthy";
      if (progressPercent < 40 || s.atRisk >= 3) health = "critical";
      else if (progressPercent < 70 || s.atRisk >= 1) health = "at-risk";

      return {
        ...s,
        progressPercent,
        health,
      };
    })
    .sort((a, b) => sprintOrder(a.name) - sprintOrder(b.name));
}

/** Verbal commitments (meetings) — org-wide; not tied to Slack workspace */
export async function getVerbalCommitments(organisationId, limit = 5) {
  const items = await Commitment.find({ organisationId })
    .sort({ detectedAt: -1 })
    .limit(limit)
    .lean();

  return items.map((c) => ({
    id: c._id.toString(),
    text: c.commitmentText,
    client: c.personName ?? "Team",
  }));
}

export default {
  getDashboardStats,
  getClientHealthList,
  getAIActivityFeed,
  getSprintHealth,
  getVerbalCommitments,
};
