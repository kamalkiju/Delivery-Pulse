// ─────────────────────────────────────────────────────────────────────────────
// slack.service.js — Multi-tenant Slack bots (one per connected workspace)
//
// Socket Mode: one SLACK_APP_TOKEN delivers events from all installed workspaces.
// authorize() picks the correct bot token per team_id.
// Each workspace also gets its own Bolt App + app.message listener (Web API token).
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

// ── Message processing (shared by coordinator + per-workspace listeners) ─────

/**
 * Handle one incoming Slack message.
 * Only channels mapped as client channels (isClientChannel) are processed.
 */
async function processIncomingMessage({ message, say, client, workspace }) {
  // Ignore bot messages and edits
  if (message.subtype) return;
  if (message.bot_id) return;

  // 1 — Log raw payload (debug: confirm Socket Mode is delivering events)
  console.log("=== RAW SLACK MESSAGE ===");
  console.log("Channel:", message.channel);
  console.log("User:", message.user);
  console.log("Text:", message.text);
  console.log("Team:", message.team ?? message.team_id);
  console.log("=========================");

  const teamId =
    message.team ?? message.team_id ?? workspace?.teamId ?? null;

  // Resolve workspace if not passed (coordinator path)
  let activeWorkspace = workspace;
  if (!activeWorkspace && teamId) {
    const entry = slackApps.get(teamId);
    activeWorkspace = entry?.workspace;
    if (!activeWorkspace) {
      activeWorkspace = await SlackWorkspace.findOne({
        teamId,
        isActive: true,
      }).lean();
    }
  }

  if (!activeWorkspace?.organisationId) {
    console.log("[slack] No active workspace for team:", teamId);
    return;
  }

  // 2 — Client lookup by Slack channel ID, scoped to this org (must be marked isClientChannel in Settings)
  const clientChannel = await SlackChannel.findOne({
    organisationId: activeWorkspace.organisationId,
    workspaceId: activeWorkspace._id,
    channelId: message.channel,
    isClientChannel: true,
  }).populate("clientId");

  console.log("Client channel found:", clientChannel ? "YES" : "NO");

  // 3 — Skip unmapped channels
  if (!clientChannel) {
    console.log("Channel not mapped as client channel:", message.channel);
    return;
  }

  if (!clientChannel.clientId) {
    console.log(
      "[slack] Channel mapped but no clientId:",
      message.channel,
    );
    return;
  }

  // 4 — Organisation + client from the mapped channel row
  const organisationId = clientChannel.organisationId;
  const clientRecord =
    typeof clientChannel.clientId === "object"
      ? clientChannel.clientId
      : null;

  if (!clientRecord) {
    console.log("[slack] Could not load client for channel:", message.channel);
    return;
  }

  const channelName = clientChannel.isPrivate
    ? `#${clientChannel.channelName} (private)`
    : `#${clientChannel.channelName}`;

  let userInfo;
  try {
    userInfo = await client.users.info({ user: message.user });
  } catch (err) {
    console.warn("[slack] users.info failed:", err.message);
    return;
  }

  const isExternal = Boolean(
    userInfo.user?.is_stranger || userInfo.user?.profile?.guest_invited_by,
  );

  const hasImage = Boolean(message.files?.length > 0);
  const imageFile = hasImage ? message.files[0] : null;

  // 5 — Save message, run AI, create draft story, reply in thread
  const savedMessage = await SlackMessage.create({
    organisationId,
    teamId: activeWorkspace.teamId ?? teamId,
    clientId: clientRecord._id,
    channelId: message.channel,
    channelName,
    senderId: message.user,
    senderName: userInfo.user?.real_name ?? userInfo.user?.name,
    senderEmail: userInfo.user?.profile?.email,
    isExternal,
    messageText: message.text ?? "",
    hasImage,
    imageUrl: imageFile?.url_private ?? undefined,
    threadTs: message.ts,
    aiProcessed: false,
  });

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
}

/**
 * Register app.message on one workspace Bolt App.
 * Called once per OAuth-connected workspace in addWorkspace().
 */
function registerMessageListener(app, workspace) {
  const teamId = workspace.teamId;

  // Catch ALL message events including subtypes (bot messages, edits, file shares)
  app.event("message", async ({ event }) => {
    console.log("=== MESSAGE EVENT FIRED ===");
    console.log("Channel:", event.channel);
    console.log("Text:", event.text);
    console.log("User:", event.user);
    console.log("Subtype:", event.subtype ?? "(none)");
    console.log("===========================");
  });

  app.message(async ({ message, say, client }) => {
    try {
      console.log(
        `[slack] app.message fired for workspace ${workspace.teamName} (${teamId})`,
      );

      const entry = slackApps.get(teamId);
      if (!entry?.workspace?.isActive) {
        console.log("[slack] Workspace inactive, skip:", teamId);
        return;
      }

      await processIncomingMessage({
        message,
        say,
        client,
        workspace: entry.workspace,
      });
    } catch (err) {
      console.error(`[slack] Error in workspace ${teamId}:`, err);
    }
  });

  console.log(
    `[slack] app.message listener registered for ${workspace.teamName} (${teamId})`,
  );
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
    console.warn(
      "[slack] SLACK_APP_TOKEN missing — Socket Mode not started",
    );
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

      const ws = await SlackWorkspace.findOne({ teamId, isActive: true });
      if (!ws) {
        throw new Error(`No active workspace for team ${teamId}`);
      }

      return {
        botToken: ws.accessToken,
        botUserId: ws.botUserId,
      };
    },
  });

  // Catch ALL message events on the coordinator (including subtypes Bolt normally filters out)
  socketCoordinator.event("message", async ({ event }) => {
    console.log("=== SOCKET COORDINATOR: ANY MESSAGE EVENT ===");
    console.log("Channel:", event.channel);
    console.log("Text:", event.text);
    console.log("Subtype:", event.subtype ?? "(none)");
    console.log("Team:", event.team);
    console.log("Bot ID:", event.bot_id ?? "(none)");
    console.log("=============================================");
  });

  socketCoordinator.message(async ({ message, say, client }) => {
    try {
      const teamId = message.team ?? message.team_id;
      if (!teamId) {
        console.log("[slack] Message missing team id, skip");
        return;
      }

      console.log("[slack] Socket coordinator received message for team:", teamId);

      let entry = slackApps.get(teamId);
      if (!entry) {
        const ws = await SlackWorkspace.findOne({ teamId, isActive: true });
        if (!ws) {
          console.log("[slack] No workspace in DB for team:", teamId);
          return;
        }
        await addWorkspace(ws);
        entry = slackApps.get(teamId);
      }

      if (!entry?.workspace?.isActive) {
        return;
      }

      await processIncomingMessage({
        message,
        say,
        client,
        workspace: entry.workspace,
      });
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
    console.error("[slack] Check that SLACK_APP_TOKEN (xapp-) and SLACK_SIGNING_SECRET belong to the same Slack app");
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

  console.log(
    `[slack] Starting bots for ${workspaces.length} active workspace(s)…`,
  );

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

  // Startup check: verify bot is a member of its mapped client channels
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
          console.log(
            `[slack] Channel ${ch.channelName} (${ch.channelId}) — bot is_member: ${info.channel.is_member}`,
          );
          if (!info.channel.is_member) {
            console.warn(
              `[slack] ⚠ Bot NOT in #${ch.channelName} — run /invite @YourBotName in Slack`,
            );
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

  if (!workspace.isActive) {
    await removeWorkspace(workspace.teamId);
    return null;
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

  slackApps.set(workspace.teamId, {
    app,
    workspace,
  });

  console.log(
    `[slack] Registered workspace bot: ${workspace.teamName} (${workspace.teamId})`,
  );

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
