// ─────────────────────────────────────────────────────────────────────────────
// slack.service.js — Multi-tenant Slack bots (one per connected workspace)
//
// Socket Mode: one SLACK_APP_TOKEN delivers events from all installed workspaces.
// authorize() picks the correct bot token per team_id.
// Each workspace also gets its own Bolt App + app.message listener (Web API token).
//
// MESSAGE PIPELINE:
//   1. Bot receives message from any channel it is in
//   2. Save message to MongoDB always (so it shows in Slack Messages page)
//   3. If channel is mapped (isClientChannel + clientId) → run AI + create story
//   4. Send auto-reply acknowledgement if mapped
// ─────────────────────────────────────────────────────────────────────────────

import { App } from "@slack/bolt";
import { WebClient } from "@slack/web-api";

import SlackMessage from "../../models/SlackMessage.model.js";
import SlackWorkspace from "../../models/SlackWorkspace.model.js";
import SlackChannel from "../../models/SlackChannel.model.js";
import aiService from "../ai/ai.service.js";
import storyService from "../story/story.service.js";
import slackReply from "./slack.reply.js";

/** Active workspace bots keyed by Slack team_id (T…) */
const slackApps = new Map();

/** Single Socket Mode connection (one per app-level token) */
let socketCoordinator = null;
let socketCoordinatorStarted = false;

const signingSecret = () => process.env.SLACK_SIGNING_SECRET;
const appLevelToken = () => process.env.SLACK_APP_TOKEN;

// ── Message processing ───────────────────────────────────────────────────────

/**
 * Handle one incoming Slack message.
 * Saves ALL messages from channels the bot is in.
 * Only runs AI + story creation for client-mapped channels.
 */
async function processIncomingMessage({ message, say, client, workspace }) {
  // Ignore bot messages, edits, and deletions
  if (message.subtype) return;
  if (message.bot_id) return;
  if (!message.text && !message.files?.length) return;

  console.log("=== RAW SLACK MESSAGE ===");
  console.log("Channel:", message.channel);
  console.log("User:", message.user);
  console.log("Text:", message.text?.slice(0, 80));
  console.log("Team:", message.team ?? message.team_id);
  console.log("=========================");

  const teamId = message.team ?? message.team_id ?? workspace?.teamId ?? null;

  // Resolve workspace if not passed (coordinator path)
  let activeWorkspace = workspace;
  if (!activeWorkspace && teamId) {
    const entry = slackApps.get(teamId);
    activeWorkspace = entry?.workspace;
    if (!activeWorkspace) {
      // Re-read from DB without isActive filter — covers wrongly-deactivated workspaces
      activeWorkspace = await SlackWorkspace.findOne({ teamId }).lean();
    }
  }

  if (!activeWorkspace?.organisationId) {
    console.log("[slack] No workspace found for team:", teamId);
    return;
  }

  const organisationId = activeWorkspace.organisationId;

  // ── Look up the channel record (may or may not be a client channel) ────────
  let channelRecord = await SlackChannel.findOne({
    organisationId,
    workspaceId: activeWorkspace._id,
    channelId: message.channel,
  }).populate("clientId");

  // Auto-create channel record if bot is in a channel not yet in our DB
  if (!channelRecord) {
    let channelName = message.channel;
    try {
      const info = await client.conversations.info({ channel: message.channel });
      channelName = info.channel?.name ?? message.channel;
    } catch {
      /* use channelId as fallback name */
    }
    channelRecord = await SlackChannel.create({
      organisationId,
      workspaceId: activeWorkspace._id,
      channelId: message.channel,
      channelName,
      isClientChannel: false,
      isPrivate: false,
      memberCount: 0,
    });
    console.log("[slack] Auto-created channel record for:", channelName);
  }

  const channelName = channelRecord.isPrivate
    ? `#${channelRecord.channelName} (private)`
    : `#${channelRecord.channelName}`;

  // ── Get sender info ────────────────────────────────────────────────────────
  let senderName = message.user ?? "Unknown";
  let senderEmail = null;
  let isExternal = false;

  try {
    const userInfo = await client.users.info({ user: message.user });
    senderName = userInfo.user?.real_name ?? userInfo.user?.name ?? senderName;
    senderEmail = userInfo.user?.profile?.email ?? null;
    isExternal = Boolean(
      userInfo.user?.is_stranger || userInfo.user?.profile?.guest_invited_by,
    );
  } catch (err) {
    console.warn("[slack] users.info failed (using fallback):", err.message);
    // Don't return — continue saving with partial info
  }

  const hasImage = Boolean(message.files?.length > 0);
  const imageFile = hasImage ? message.files[0] : null;

  // ── Determine client mapping ───────────────────────────────────────────────
  const isClientMapped =
    channelRecord.isClientChannel && channelRecord.clientId != null;

  const clientRecord =
    isClientMapped && typeof channelRecord.clientId === "object"
      ? channelRecord.clientId
      : null;

  // ── Save message to MongoDB (always) ──────────────────────────────────────
  const savedMessage = await SlackMessage.create({
    organisationId,
    teamId: activeWorkspace.teamId ?? teamId,
    clientId: clientRecord?._id ?? null,
    channelId: message.channel,
    channelName,
    senderId: message.user,
    senderName,
    senderEmail,
    isExternal,
    messageText: message.text ?? "",
    hasImage,
    imageUrl: imageFile?.url_private ?? undefined,
    threadTs: message.ts,
    aiProcessed: false,
  });

  console.log(
    `[slack] Message saved from ${channelName} (${isClientMapped ? "mapped to client" : "not mapped"})`,
  );

  // ── AI processing + story creation only for mapped client channels ─────────
  if (!isClientMapped || !clientRecord) {
    console.log(
      `[slack] Skipping AI — channel not mapped to a client. Go to Settings → Slack → enable Monitor + assign client.`,
    );
    return;
  }

  try {
    const aiResult = await aiService.analyzeMessage({
      text: message.text,
      imageUrl: imageFile ? imageFile.url_private : null,
      clientName: clientRecord.name,
    });

    const story = await storyService.createDraftStory({
      aiResult,
      organisationId,
      clientId: clientRecord._id,
      sourceRef: savedMessage._id,
      sourceQuote: message.text,
    });

    savedMessage.storyId = story._id;
    savedMessage.aiProcessed = true;
    await savedMessage.save();

    await slackReply.sendAcknowledgement({
      say,
      threadTs: message.ts,
      storyId: story._id,
      clientName: clientRecord.name,
    });

    savedMessage.autoReplySent = true;
    await savedMessage.save();

    console.log(
      `[slack] ${activeWorkspace.teamName ?? teamId} → story ${story._id} for ${clientRecord.name}`,
    );
  } catch (err) {
    console.error("[slack] AI/story processing failed:", err.message);
    // Message is already saved — don't lose it on AI failure
  }
}

/**
 * Register app.message on one workspace Bolt App.
 */
function registerMessageListener(app, workspace) {
  const teamId = workspace.teamId;

  app.event("message", async ({ event }) => {
    console.log("=== MESSAGE EVENT ===", event.channel, event.subtype ?? "(none)");
  });

  app.message(async ({ message, say, client }) => {
    try {
      console.log(`[slack] app.message fired for workspace ${workspace.teamName} (${teamId})`);

      // Re-read workspace from DB so we always have fresh isActive status
      const freshWorkspace = await SlackWorkspace.findOne({ teamId }).lean();
      if (!freshWorkspace) {
        console.log("[slack] Workspace not found in DB, skip:", teamId);
        return;
      }

      // Update in-memory entry with fresh data
      const entry = slackApps.get(teamId);
      if (entry) entry.workspace = freshWorkspace;

      await processIncomingMessage({ message, say, client, workspace: freshWorkspace });
    } catch (err) {
      console.error(`[slack] Error in workspace ${teamId}:`, err);
    }
  });

  console.log(`[slack] app.message listener registered for ${workspace.teamName} (${teamId})`);
}

/**
 * Create a Bolt App for one workspace (OAuth bot token).
 */
function createWorkspaceBoltApp(workspace) {
  const app = new App({
    token: workspace.accessToken,
    signingSecret: signingSecret(),
  });

  registerMessageListener(app, workspace);
  return app;
}

/**
 * Socket Mode coordinator — one connection, authorize() per team_id.
 */
async function ensureSocketCoordinator() {
  if (socketCoordinatorStarted && socketCoordinator) {
    return socketCoordinator;
  }

  if (!appLevelToken()) {
    console.warn("[slack] SLACK_APP_TOKEN missing — Socket Mode not started");
    return null;
  }

  socketCoordinator = new App({
    signingSecret: signingSecret(),
    socketMode: true,
    appToken: appLevelToken(),
    authorize: async ({ teamId }) => {
      const entry = slackApps.get(teamId);
      if (entry?.workspace?.accessToken) {
        return {
          botToken: entry.workspace.accessToken,
          botUserId: entry.workspace.botUserId,
        };
      }

      // Re-read from DB without isActive filter
      const ws = await SlackWorkspace.findOne({ teamId });
      if (!ws?.accessToken) {
        throw new Error(`No workspace token for team ${teamId}`);
      }

      return {
        botToken: ws.accessToken,
        botUserId: ws.botUserId,
      };
    },
  });

  socketCoordinator.event("message", async ({ event }) => {
    console.log("=== COORDINATOR EVENT ===", event.channel, event.subtype ?? "(none)", "team:", event.team);
  });

  socketCoordinator.message(async ({ message, say, client }) => {
    try {
      const teamId = message.team ?? message.team_id;
      if (!teamId) {
        console.log("[slack] Message missing team id, skip");
        return;
      }

      console.log("[slack] Socket coordinator received message for team:", teamId);

      // Re-read workspace from DB (avoids stale isActive in memory)
      let freshWorkspace = await SlackWorkspace.findOne({ teamId }).lean();
      if (!freshWorkspace) {
        console.log("[slack] No workspace in DB for team:", teamId);
        return;
      }

      // Register workspace in memory if missing (new workspace connected mid-session)
      if (!slackApps.has(teamId)) {
        await addWorkspace(freshWorkspace);
        freshWorkspace = slackApps.get(teamId)?.workspace ?? freshWorkspace;
      }

      await processIncomingMessage({ message, say, client, workspace: freshWorkspace });
    } catch (err) {
      console.error("[slack] Coordinator message error:", err);
    }
  });

  try {
    await socketCoordinator.start();
    socketCoordinatorStarted = true;
    console.log("[slack] Socket Mode coordinator started (multi-workspace)");
  } catch (err) {
    socketCoordinator = null;
    socketCoordinatorStarted = false;
    console.error("[slack] Socket Mode failed to start:", err.message);
    throw err;
  }

  return socketCoordinator;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * startSlack — boot: load workspaces, register listeners, start Socket Mode.
 */
export async function startSlack() {
  const workspaces = await SlackWorkspace.find({ isActive: true });

  console.log(`[slack] Starting bots for ${workspaces.length} active workspace(s)…`);

  for (const workspace of workspaces) {
    try {
      await addWorkspace(workspace);
    } catch (err) {
      console.error(
        `[slack] Failed to register workspace ${workspace.teamName} (${workspace.teamId}) — skipping:`,
        err.message,
      );
    }
  }

  await ensureSocketCoordinator();

  // Startup check: verify bot membership in mapped channels
  for (const [teamId, entry] of slackApps) {
    try {
      const slackClient = new WebClient(entry.workspace.accessToken);
      const channels = await SlackChannel.find({
        workspaceId: entry.workspace._id,
        isClientChannel: true,
      });
      for (const ch of channels) {
        try {
          const info = await slackClient.conversations.info({ channel: ch.channelId });
          if (!info.channel.is_member) {
            console.warn(`[slack] ⚠ Bot NOT in #${ch.channelName} — /invite @DeliveryPulse in Slack`);
          }
        } catch (err) {
          console.warn(`[slack] Could not check channel ${ch.channelId}:`, err.message);
        }
      }
    } catch (err) {
      console.warn(`[slack] Channel membership check failed for ${teamId}:`, err.message);
    }
  }

  return { slackApps, socketCoordinator };
}

/**
 * addWorkspace — register Bolt App + app.message for one workspace.
 */
export async function addWorkspace(workspaceDoc) {
  const workspace =
    workspaceDoc && typeof workspaceDoc.toObject === "function"
      ? workspaceDoc.toObject()
      : workspaceDoc;

  if (!workspace?.teamId || !workspace?.accessToken) {
    throw new Error("addWorkspace: teamId and accessToken are required");
  }

  const existing = slackApps.get(workspace.teamId);
  if (existing?.app) {
    try {
      await existing.app.stop();
    } catch {
      /* not started */
    }
  }

  const app = createWorkspaceBoltApp(workspace);

  slackApps.set(workspace.teamId, { app, workspace });

  console.log(`[slack] Registered workspace bot: ${workspace.teamName} (${workspace.teamId})`);

  await ensureSocketCoordinator();

  return app;
}

/**
 * removeWorkspace — stop listening for one workspace.
 */
export async function removeWorkspace(teamId) {
  const entry = slackApps.get(teamId);

  if (entry?.app) {
    try {
      await entry.app.stop();
    } catch (err) {
      console.warn(`[slack] stop workspace ${teamId}:`, err.message);
    }
  }

  slackApps.delete(teamId);
  console.log(`[slack] Removed workspace bot for team ${teamId}`);
}

export function getActiveWorkspaceTeamIds() {
  return [...slackApps.keys()];
}

export { slackApps, socketCoordinator };

export default {
  startSlack,
  addWorkspace,
  removeWorkspace,
  getActiveWorkspaceTeamIds,
  slackApps,
};
