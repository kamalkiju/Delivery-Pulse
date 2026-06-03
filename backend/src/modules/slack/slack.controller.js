// slack.controller.js — Slack Messages API (organisation-scoped, multi-workspace)

import SlackMessage from "../../models/SlackMessage.model.js";
import SlackWorkspace from "../../models/SlackWorkspace.model.js";

function formatTimeAgo(date) {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function initialsFromName(name) {
  const parts = (name ?? "?").trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? "??").toUpperCase();
}

const AVATAR_COLORS = [
  "#0088ff",
  "#10b981",
  "#f59e0b",
  "#dc2626",
  "#6366f1",
  "#7c3aed",
];

function avatarColorForName(name) {
  let hash = 0;
  for (let i = 0; i < (name ?? "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function statusForMessage(msg) {
  if (msg.aiProcessed && msg.storyId) {
    const story = typeof msg.storyId === "object" ? msg.storyId : null;
    if (story?.status === "pending-review") {
      return { variant: "at-risk", label: "Pending Review" };
    }
    if (story?.status === "rejected") {
      return { variant: "critical", label: "Rejected" };
    }
    return { variant: "healthy", label: "Story Created" };
  }
  if (!msg.aiProcessed) {
    return { variant: "info", label: "Unprocessed" };
  }
  return { variant: "info", label: "Received" };
}

function toListItem(msg, workspaceName) {
  const client =
    msg.clientId && typeof msg.clientId === "object" ? msg.clientId : null;
  const sender = msg.senderName ?? "Unknown sender";
  const channel =
    msg.channelName ??
    (msg.channelId ? `#${msg.channelId}` : "#unknown-channel");

  const wsLabel = workspaceName ?? "Workspace";
  const sourceLine = `From: ${channel} · ${wsLabel}`;

  const { variant, label } = statusForMessage(msg);

  return {
    id: msg._id.toString(),
    messageText: msg.messageText ?? "",
    senderName: sender,
    channelName: channel,
    workspaceName: wsLabel,
    sourceLine,
    teamId: msg.teamId ?? null,
    createdAt: msg.createdAt,
    time: formatTimeAgo(msg.createdAt),
    aiProcessed: msg.aiProcessed ?? false,
    storyId:
      msg.storyId && typeof msg.storyId === "object"
        ? msg.storyId._id.toString()
        : msg.storyId?.toString() ?? null,
    hasImage: msg.hasImage ?? false,
    isExternal: msg.isExternal ?? false,
    autoReplySent: msg.autoReplySent ?? false,
    clientName: client?.name ?? sender,
    company: client?.company ?? "",
    initials: initialsFromName(sender),
    avatarColor: avatarColorForName(sender),
    statusVariant: variant,
    statusLabel: label,
    senderType: msg.isExternal ? "client" : "internal",
  };
}

/**
 * GET /api/slack/debug — diagnostic endpoint: shows raw counts to help
 * identify whether messages exist in DB and what the org/workspace state is.
 */
export async function debugMessages(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    if (!organisationId) {
      return res.status(400).json({ error: "No organisationId in token" });
    }

    const [totalMessages, orgMessages, workspaces] = await Promise.all([
      SlackMessage.countDocuments({}),
      SlackMessage.countDocuments({ organisationId }),
      SlackWorkspace.find({ organisationId }).lean(),
    ]);

    const recentRaw = await SlackMessage.find({ organisationId })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    return res.json({
      organisationId,
      totalMessagesInDB: totalMessages,
      messagesForThisOrg: orgMessages,
      workspacesForThisOrg: workspaces.map((w) => ({
        id: w._id,
        teamId: w.teamId,
        teamName: w.teamName,
        isActive: w.isActive,
      })),
      recentMessages: recentRaw.map((m) => ({
        id: m._id,
        teamId: m.teamId,
        channelName: m.channelName,
        senderName: m.senderName,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/** GET /api/slack/messages — org-scoped; x-workspace-id narrows to one Slack workspace */
export async function listMessages(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;

    if (!organisationId) {
      return res.status(400).json({ message: "Missing organisation" });
    }

    console.log("[listMessages] org:", organisationId);

    // Fetch workspaces for sidebar display only — NOT used to filter messages
    const allWorkspaces = await SlackWorkspace.find({ organisationId })
      .sort({ connectedAt: -1 })
      .lean();

    const activeWorkspaces = allWorkspaces.filter((w) => w.isActive);
    const primary = activeWorkspaces[0] ?? allWorkspaces[0];
    const workspaceName = primary?.teamName ?? null;
    const teamIdToName = Object.fromEntries(
      allWorkspaces.map((w) => [w.teamId, w.teamName]),
    );

    // Filter by organisationId only — no teamId restriction so every ingested
    // message is returned regardless of which workspace it came from
    const messages = await SlackMessage.find({ organisationId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("clientId", "name company")
      .populate("storyId", "title status type priority")
      .lean();

    console.log("[listMessages] found:", messages.length, "messages");

    return res.json({
      success: true,
      workspace: {
        connected: activeWorkspaces.length > 0,
        teamName: workspaceName,
        teamId: primary?.teamId ?? null,
        displayName: workspaceName ? `${workspaceName} Workspace` : null,
        activeWorkspaceId: primary?._id?.toString() ?? null,
      },
      // Switcher list shows only active workspaces; inactive ones still contribute messages above.
      workspaces: activeWorkspaces.map((w) => ({
        id: w._id.toString(),
        teamId: w.teamId,
        teamName: w.teamName,
        teamIcon: w.teamIcon,
      })),
      messages: messages.map((m) =>
        toListItem(m, teamIdToName[m.teamId] ?? workspaceName ?? undefined),
      ),
    });
  } catch (error) {
    console.error("[slack] listMessages:", error);
    return res.status(500).json({ message: error.message ?? "Failed to load messages" });
  }
}

/** GET /api/slack/messages/:id */
export async function getMessageDetail(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    if (!organisationId) {
      return res.status(400).json({ message: "Missing organisation" });
    }

    const msg = await SlackMessage.findOne({
      _id: req.params.id,
      organisationId,
    })
      .populate("clientId", "name company")
      .populate("storyId")
      .lean();

    if (!msg) {
      return res.status(404).json({ message: "Message not found" });
    }

    const workspace = msg.teamId
      ? await SlackWorkspace.findOne({
          organisationId,
          teamId: msg.teamId,
          isActive: true,
        }).lean()
      : await SlackWorkspace.findOne({
          organisationId,
          isActive: true,
        })
          .sort({ connectedAt: -1 })
          .lean();

    const listItem = toListItem(msg, workspace?.teamName ?? undefined);
    const story =
      msg.storyId && typeof msg.storyId === "object" ? msg.storyId : null;

    let generatedStory = null;
    if (story) {
      generatedStory = {
        id: story._id.toString(),
        ticketId: `DP-${story._id.toString().slice(-4).toUpperCase()}`,
        title: story.title,
        description: story.description ?? "",
        type: story.type,
        priority: story.priority,
        status: story.status,
        acceptanceCriteria: story.acceptanceCriteria ?? [],
        sourceQuote: story.sourceQuote ?? msg.messageText ?? "",
        isAIGenerated: story.isAIGenerated ?? true,
      };
    }

    const aiAnalysis = story
      ? {
          type: story.type,
          priority: story.priority,
          status: story.status,
          title: story.title,
          summary: story.description,
        }
      : msg.aiProcessed
        ? { summary: "Message processed — story linked" }
        : null;

    return res.json({
      success: true,
      message: {
        ...listItem,
        imageUrl: msg.imageUrl ?? null,
        threadTs: msg.threadTs,
        channelId: msg.channelId,
        originalText: msg.messageText ?? "",
        aiAnalysis,
        generatedStory,
      },
    });
  } catch (error) {
    console.error("[slack] getMessageDetail:", error);
    return res.status(500).json({ message: error.message ?? "Failed to load message" });
  }
}
