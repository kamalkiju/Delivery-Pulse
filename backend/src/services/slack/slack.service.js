// ─────────────────────────────────────────────────────────────────────────────
// slack.service.js — Multi-tenant Slack bots (one per connected workspace)
//
// ARCHITECTURE (how multiple DeliveryPulse customers share one Slack app):
//
//   ┌─────────────────────────────────────────────────────────────┐
//   │  Slack Socket Mode (one SLACK_APP_TOKEN in .env)             │
//   │  Delivers events from ALL installed workspaces              │
//   └──────────────────────────┬──────────────────────────────────┘
//                              │ message event includes team_id
//                              ▼
//   ┌─────────────────────────────────────────────────────────────┐
//   │  socketCoordinator — single Bolt App with authorize()         │
//   │  Picks the correct workspace.accessToken per team_id        │
//   └──────────────────────────┬──────────────────────────────────┘
//                              │
//          ┌───────────────────┼───────────────────┐
//          ▼                   ▼                   ▼
//   slackApps Map        slackApps Map        slackApps Map
//   teamId: T001         teamId: T002         teamId: T003
//   { app, workspace }   { app, workspace }   { app, workspace }
//
// Each OAuth-connected workspace gets its own Bolt App object (bot token).
// slackApps stores them so we can add/remove workspaces without restarting
// the whole server. Socket Mode stays one connection; authorize() swaps tokens.
// ─────────────────────────────────────────────────────────────────────────────

import { App } from "@slack/bolt";

import SlackMessage from "../../models/SlackMessage.model.js";
import SlackWorkspace from "../../models/SlackWorkspace.model.js";
import SlackChannel from "../../models/SlackChannel.model.js";
import aiService from "../ai/ai.service.js";
import storyService from "../story/story.service.js";
import slackReply from "./slack.reply.js";

/** Active workspace bots keyed by Slack team_id (T…) */
const slackApps = new Map();

/** Single Socket Mode connection (Slack allows one per app-level token) */
let socketCoordinator = null;
let socketCoordinatorStarted = false;

const signingSecret = () => process.env.SLACK_SIGNING_SECRET;
const appLevelToken = () => process.env.SLACK_APP_TOKEN;

// ── Message processing (shared by every workspace) ───────────────────────────

/**
 * Handle one incoming Slack message for a known workspace.
 * Only client channels (isClientChannel) create stories.
 */
async function processIncomingMessage({ message, say, client, workspace }) {
  if (message.subtype) return;
  if (message.bot_id) return;

  const organisationId = workspace.organisationId;
  const teamId = workspace.teamId;

  // Step 1 — Find SlackChannel row for this channel in this workspace
  const monitored = await SlackChannel.findOne({
    organisationId,
    workspaceId: workspace._id,
    channelId: message.channel,
    isClientChannel: true,
  }).populate("clientId");

  if (!monitored) {
    return;
  }

  if (!monitored.clientId) {
    console.log(
      `[slack] Channel ${message.channel} marked client but no clientId — skip`,
    );
    return;
  }

  const clientRecord =
    typeof monitored.clientId === "object" ? monitored.clientId : null;

  if (!clientRecord) {
    return;
  }

  const channelName = monitored.isPrivate
    ? `#${monitored.channelName} (private)`
    : `#${monitored.channelName}`;

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

  const savedMessage = await SlackMessage.create({
    organisationId,
    teamId,
    clientId: clientRecord._id,
    channelId: message.channel,
    channelName,
    senderId: message.user,
    senderName: userInfo.user?.real_name ?? userInfo.user?.name,
    senderEmail: userInfo.user?.profile?.email,
    isExternal,
    messageText: message.text,
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
    `[slack] ${workspace.teamName} (${teamId}) → story ${story._id} for ${clientRecord.name}`,
  );
}

/**
 * Register app.message on a Bolt App for one workspace.
 * The handler resolves the latest workspace doc from slackApps by team_id.
 */
function registerMessageListener(app, workspace) {
  const teamId = workspace.teamId;

  app.message(async ({ message, say, client }) => {
    try {
      const entry = slackApps.get(teamId);
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
      console.error(`[slack] Error in workspace ${teamId}:`, err);
    }
  });
}

/**
 * Create a Bolt App for one workspace using its OAuth bot token.
 * This workspace's token is used for Web API calls (join channel, etc.).
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
 * Ensure the Socket Mode coordinator is running (once per server process).
 * authorize() supplies the correct bot token for each team_id on every event.
 */
async function ensureSocketCoordinator() {
  if (socketCoordinatorStarted && socketCoordinator) {
    return socketCoordinator;
  }

  if (!appLevelToken()) {
    console.warn(
      "[slack] SLACK_APP_TOKEN missing — Socket Mode not started (OAuth workspaces only work after token is set)",
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

  socketCoordinator.message(async ({ message, say, client }) => {
    try {
      const teamId = message.team ?? message.team_id;
      if (!teamId) return;

      const entry = slackApps.get(teamId);
      if (!entry) {
        const ws = await SlackWorkspace.findOne({ teamId, isActive: true });
        if (!ws) return;
        await addWorkspace(ws);
        const refreshed = slackApps.get(teamId);
        if (!refreshed) return;
        await processIncomingMessage({
          message,
          say,
          client,
          workspace: refreshed.workspace,
        });
        return;
      }

      if (!entry.workspace.isActive) return;

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

  await socketCoordinator.start();
  socketCoordinatorStarted = true;
  console.log("[slack] Socket Mode coordinator started (multi-workspace)");

  return socketCoordinator;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * startSlack — called from server.js on boot.
 * Step 1: Load every active SlackWorkspace from MongoDB.
 * Step 2: Create a Bolt App per workspace and store in slackApps.
 * Step 3: Start the single Socket Mode coordinator.
 */
export async function startSlack() {
  const workspaces = await SlackWorkspace.find({ isActive: true });

  console.log(
    `[slack] Starting bots for ${workspaces.length} active workspace(s)…`,
  );

  for (const workspace of workspaces) {
    await addWorkspace(workspace);
  }

  await ensureSocketCoordinator();

  return { slackApps, socketCoordinator };
}

/**
 * addWorkspace — register one workspace bot (OAuth callback or boot).
 * Creates a dedicated App with that workspace's accessToken.
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
 * removeWorkspace — stop listening for one workspace (disconnect).
 * Removes from slackApps Map; authorize() will reject that team_id next.
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

/** List connected team IDs (debug / health) */
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
