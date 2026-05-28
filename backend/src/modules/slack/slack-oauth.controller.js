// ─────────────────────────────────────────────────────────────────────────────
// slack-oauth.controller.js — Slack OAuth 2.0 with PKCE (Proof Key for Code Exchange)
//
// WHY PKCE?
//   Slack now requires PKCE for many apps. The browser never sees the client_secret;
//   instead we prove we started the flow by sending a one-time code_verifier with the token exchange.
//
// FLOW (for designers / new developers):
//   1. connect  — create random verifier + challenge → redirect user to Slack
//   2. User clicks Allow on Slack
//   3. callback — Slack returns ?code=&state= → we exchange code + verifier for bot token
//   4. Save SlackWorkspace + channels → redirect to frontend
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import axios from "axios";
import { WebClient } from "@slack/web-api";

import SlackWorkspace from "../../models/SlackWorkspace.model.js";
import SlackChannel from "../../models/SlackChannel.model.js";
import Client from "../../models/Client.model.js";
import { addWorkspace, removeWorkspace } from "../../services/slack/slack.service.js";

const frontendUrl = () =>
  process.env.FRONTEND_URL || "http://localhost:5173";

// Bot scopes requested at install (comma-separated in authorize URL)
const SLACK_BOT_SCOPES = [
  "channels:history",
  "channels:read",
  "channels:join",
  "chat:write",
  "files:read",
  "users:read",
  "users:read.email",
  "groups:history",
  "groups:read",
  "im:history",
  "im:write",
  "mpim:history",
].join(",");

// stores code_verifier temporarily during OAuth flow (key = random state string)
const pkceStore = new Map();

// ── PKCE helpers ─────────────────────────────────────────────────────────────

/**
 * generatePKCE — create the secret pair Slack expects for PKCE (RFC 7636).
 *
 * code_verifier  — random secret we keep server-side until callback
 * code_challenge — hash of verifier; Slack stores this and checks it when we exchange the code
 */
function generatePKCE() {
  // random string 43–128 chars, base64url encoded (high entropy secret)
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  // SHA256 hash of verifier, base64url encoded (sent to Slack in authorize URL)
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

/** Remove PKCE entries older than 10 minutes (user may abandon OAuth mid-flow) */
function cleanExpiredPkceEntries() {
  const maxAgeMs = 10 * 60 * 1000;
  for (const [key, value] of pkceStore.entries()) {
    if (Date.now() - value.createdAt > maxAgeMs) {
      pkceStore.delete(key);
    }
  }
}

function getOrgAndUser(req) {
  const organisationId = req.user?.orgId ?? req.user?.organisationId;
  const userId = req.user?.userId ?? req.user?.id;
  return { organisationId, userId };
}

function successRedirect({ returnTo, teamName, workspaceId }) {
  if (returnTo === "onboarding") {
    return `${frontendUrl()}/onboarding?slack=connected&team=${encodeURIComponent(teamName)}&workspaceId=${workspaceId}`;
  }
  return `${frontendUrl()}/settings/slack?connected=true&workspace=${encodeURIComponent(teamName)}&workspaceId=${workspaceId}`;
}

function errorRedirect({ returnTo, errorCode }) {
  const code = encodeURIComponent(errorCode);
  if (returnTo === "onboarding") {
    return `${frontendUrl()}/onboarding?connected=false&error=${code}`;
  }
  return `${frontendUrl()}/settings/slack?connected=false&error=${code}`;
}

// ── FUNCTION 1 — GET /api/slack/connect ──────────────────────────────────────

/**
 * connect — start OAuth: generate PKCE, store verifier, redirect to Slack authorize URL.
 */
export async function connect(req, res) {
  try {
    const { organisationId, userId } = getOrgAndUser(req);

    if (!organisationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Missing organisation or user in session",
      });
    }

    if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_REDIRECT_URI) {
      return res.status(500).json({
        success: false,
        message: "Slack OAuth is not configured in backend/.env",
      });
    }

    const returnTo =
      req.query.returnTo === "onboarding" ? "onboarding" : "settings";

    // Step 1 — Generate PKCE values (verifier stays secret; challenge goes to Slack)
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Step 2 — random state to prevent CSRF attacks (Slack echoes this on callback)
    const state = crypto.randomBytes(16).toString("hex");

    // Step 3 — Store verifier with state as key (retrieved in callback using state)
    pkceStore.set(state, {
      codeVerifier,
      organisationId: organisationId.toString(),
      userId: userId.toString(),
      returnTo,
      createdAt: Date.now(),
    });

    // Step 4 — Clean old entries older than 10 minutes
    cleanExpiredPkceEntries();

    // Step 5 — Build OAuth URL with PKCE parameters
    const params = new URLSearchParams();
    // client_id — Slack app ID from api.slack.com
    params.append("client_id", process.env.SLACK_CLIENT_ID);
    // scope — bot permissions requested at install
    params.append("scope", SLACK_BOT_SCOPES);
    // redirect_uri — must match SLACK_REDIRECT_URI in .env and Slack app settings exactly
    params.append("redirect_uri", process.env.SLACK_REDIRECT_URI);
    // state — CSRF token; key into pkceStore
    params.append("state", state);
    // code_challenge — SHA256(verifier) sent to Slack (verifier never leaves our server until token exchange)
    params.append("code_challenge", codeChallenge);
    // code_challenge_method — S256 means challenge is SHA256 hash (Slack standard)
    params.append("code_challenge_method", "S256");

    const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    return res.redirect(authUrl);
  } catch (error) {
    console.error("[slack-oauth] connect:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Could not start Slack OAuth",
    });
  }
}

// ── FUNCTION 2 — GET /api/slack/callback (public — no JWT) ───────────────────

/**
 * callback — Slack redirects here after Allow. Exchange code + PKCE verifier for tokens.
 */
export async function callback(req, res) {
  const defaultReturnTo = "settings";

  try {
    // Step 1 — Check for Slack error (user denied access, etc.)
    if (req.query.error) {
      return res.redirect(
        errorRedirect({
          returnTo: defaultReturnTo,
          errorCode: String(req.query.error),
        }),
      );
    }

    // Step 2 — Get code and state from query string
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(
        errorRedirect({ returnTo: defaultReturnTo, errorCode: "missing_params" }),
      );
    }

    // Step 3 — Retrieve PKCE verifier from store (one-time use)
    const pkceData = pkceStore.get(String(state));
    if (!pkceData) {
      return res.redirect(
        errorRedirect({
          returnTo: defaultReturnTo,
          errorCode: "invalid_state",
        }),
      );
    }

    const { codeVerifier, organisationId, userId, returnTo } = pkceData;
    // delete after use — one time only
    pkceStore.delete(String(state));

    // Step 4 — Exchange authorization code for bot token (must include code_verifier for PKCE)
    const tokenResponse = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code: String(code),
        redirect_uri: process.env.SLACK_REDIRECT_URI,
        code_verifier: codeVerifier,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const tokenData = tokenResponse.data;

    if (!tokenData.ok) {
      console.error("Slack token error:", tokenData.error);
      return res.redirect(
        errorRedirect({
          returnTo: returnTo ?? defaultReturnTo,
          errorCode: tokenData.error ?? "token_exchange_failed",
        }),
      );
    }

    // Step 5 — Extract workspace info from Slack response
    const access_token =
      tokenData.access_token ?? tokenData.bot?.bot_access_token ?? null;
    const team = tokenData.team ?? {};
    const bot_user_id =
      tokenData.bot_user_id ?? tokenData.bot?.bot_user_id ?? null;

    if (!access_token || !team.id) {
      return res.redirect(
        errorRedirect({
          returnTo: returnTo ?? defaultReturnTo,
          errorCode: "missing_token",
        }),
      );
    }

    const teamId = team.id;
    const teamName = team.name ?? "Slack workspace";
    const teamIcon =
      team.icon?.image_132 ?? team.icon?.image_68 ?? null;

    let teamDomain = null;
    try {
      const slackClient = new WebClient(access_token);
      const teamInfo = await slackClient.team.info();
      if (teamInfo.ok) {
        teamDomain = teamInfo.team?.domain ?? null;
      }
    } catch {
      /* optional */
    }

    // Step 6 — Save workspace to MongoDB (upsert per org + teamId)
    const workspace = await SlackWorkspace.findOneAndUpdate(
      { organisationId, teamId },
      {
        organisationId,
        teamId,
        teamName,
        teamDomain,
        teamIcon,
        accessToken: access_token,
        botUserId: bot_user_id,
        installedBy: userId,
        isActive: true,
        connectedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Step 7 — Fetch and save all channels for this workspace
    const slackClient = new WebClient(access_token);
    try {
      const channelsResponse = await slackClient.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
      });

      if (channelsResponse.ok) {
        for (const channel of channelsResponse.channels ?? []) {
          await SlackChannel.findOneAndUpdate(
            { workspaceId: workspace._id, channelId: channel.id },
            {
              organisationId,
              workspaceId: workspace._id,
              channelId: channel.id,
              channelName: channel.name,
              memberCount: channel.num_members || 0,
              isPrivate: Boolean(channel.is_private),
              isClientChannel: false,
            },
            { upsert: true, new: true },
          );
        }
      }
    } catch (channelError) {
      // non-fatal — workspace still saved even if channels fail
      console.error("Could not fetch channels:", channelError.message);
    }

    // Start Socket Mode / message listener for this workspace
    try {
      await addWorkspace(workspace);
    } catch (botErr) {
      console.error("[slack-oauth] addWorkspace:", botErr.message);
    }

    console.log(
      `[slack-oauth] Connected ${teamName} (${teamId}) for org ${organisationId}`,
    );

    // Step 8 — Redirect to frontend with success
    return res.redirect(
      successRedirect({
        returnTo: returnTo ?? defaultReturnTo,
        teamName,
        workspaceId: workspace._id.toString(),
      }),
    );
  } catch (error) {
    console.error("Slack OAuth callback error:", error.message);
    return res.redirect(
      errorRedirect({
        returnTo: defaultReturnTo,
        errorCode: "server_error",
      }),
    );
  }
}

// ── FUNCTION 3 — GET /api/slack/status ───────────────────────────────────────

/** getStatus — connection summary for UI (never expose accessToken) */
export async function getStatus(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const workspaces = await SlackWorkspace.find({
      organisationId,
      isActive: true,
    })
      .select("-accessToken")
      .sort({ connectedAt: -1 })
      .lean();

    if (workspaces.length === 0) {
      return res.json({
        success: true,
        connected: false,
        workspace: null,
        teamName: null,
        teamId: null,
        workspaces: [],
        monitoredChannelCount: 0,
        botActive: false,
      });
    }

    const primary = workspaces[0];
    const monitoredChannelCount = await SlackChannel.countDocuments({
      organisationId,
      isClientChannel: true,
    });

    return res.json({
      success: true,
      connected: true,
      workspace: {
        teamName: primary.teamName,
        teamId: primary.teamId,
        connectedAt: primary.connectedAt,
      },
      teamName: primary.teamName,
      teamId: primary.teamId,
      teamIcon: primary.teamIcon,
      connectedAt: primary.connectedAt,
      activeWorkspaceId: primary._id.toString(),
      workspaces: workspaces.map((w) => ({
        id: w._id.toString(),
        teamName: w.teamName,
        teamIcon: w.teamIcon,
      })),
      monitoredChannelCount,
      botActive: true,
    });
  } catch (error) {
    console.error("[slack-oauth] getStatus:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to load status",
    });
  }
}

/** Alias for existing routes */
export const status = getStatus;

// ── FUNCTION 4 — GET /api/slack/workspaces ───────────────────────────────────

/** getWorkspaces — all active workspaces for org (no accessToken in response) */
export async function getWorkspaces(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const workspaces = await SlackWorkspace.find({
      organisationId,
      isActive: true,
    })
      .select("-accessToken")
      .sort({ connectedAt: -1 })
      .lean();

    const result = await Promise.all(
      workspaces.map(async (ws) => {
        const channelCount = await SlackChannel.countDocuments({
          workspaceId: ws._id,
          isClientChannel: true,
        });
        return {
          id: ws._id.toString(),
          teamId: ws.teamId,
          teamName: ws.teamName,
          teamDomain: ws.teamDomain,
          teamIcon: ws.teamIcon,
          connectedAt: ws.connectedAt,
          channelCount,
        };
      }),
    );

    return res.json({
      success: true,
      workspaces: result,
      connected: result.length > 0,
    });
  } catch (error) {
    console.error("[slack-oauth] getWorkspaces:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to load workspaces",
    });
  }
}

// ── FUNCTION 5 — GET /api/slack/channels (+ /workspaces/:id/channels) ─────────

/** getChannels — channels for org; optional ?workspaceId= or :workspaceId param */
export async function getChannels(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    const workspaceId =
      req.params.workspaceId ?? req.query.workspaceId ?? null;

    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const channelFilter = { organisationId };

    let workspace = null;
    if (workspaceId) {
      workspace = await SlackWorkspace.findOne({
        _id: workspaceId,
        organisationId,
        isActive: true,
      }).select("-accessToken");

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: "Workspace not found",
        });
      }
      channelFilter.workspaceId = workspace._id;
    }

    const channels = await SlackChannel.find(channelFilter)
      .populate("clientId", "name company")
      .sort({ channelName: 1 })
      .lean();

    const clients = await Client.find({ organisationId })
      .select("name company")
      .lean();

    const payload = {
      success: true,
      channels: channels.map((ch) => ({
        id: ch._id.toString(),
        channelId: ch.channelId,
        channelName: ch.channelName,
        displayName: ch.isPrivate
          ? `#${ch.channelName} (private)`
          : `#${ch.channelName}`,
        memberCount: ch.memberCount,
        isPrivate: ch.isPrivate,
        isClientChannel: ch.isClientChannel,
        clientId:
          ch.clientId && typeof ch.clientId === "object"
            ? ch.clientId._id.toString()
            : ch.clientId?.toString() ?? null,
        clientName:
          ch.clientId && typeof ch.clientId === "object"
            ? ch.clientId.name
            : null,
      })),
      clients: clients.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        company: c.company,
      })),
    };

    if (workspace) {
      payload.workspace = {
        id: workspace._id.toString(),
        teamName: workspace.teamName,
        teamIcon: workspace.teamIcon,
      };
    }

    return res.json(payload);
  } catch (error) {
    console.error("[slack-oauth] getChannels:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to load channels",
    });
  }
}

/** Onboarding shortcut — latest or query workspace */
export async function getChannelsLegacy(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    let workspaceId = req.query.workspaceId;

    if (!workspaceId) {
      const latest = await SlackWorkspace.findOne({
        organisationId,
        isActive: true,
      })
        .sort({ connectedAt: -1 })
        .select("_id");

      workspaceId = latest?._id?.toString();
    }

    if (!workspaceId) {
      return res.json({ success: true, channels: [], clients: [] });
    }

    req.params.workspaceId = workspaceId;
    return getChannels(req, res);
  } catch (error) {
    console.error("[slack-oauth] getChannelsLegacy:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to load channels",
    });
  }
}

// ── FUNCTION 6 — PATCH /api/slack/channels/:channelId ────────────────────────

/** updateChannel — mark client channel; bot joins via conversations.join */
export async function updateChannel(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    const { channelId } = req.params;
    const { isClientChannel, clientId } = req.body ?? {};

    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const channel = await SlackChannel.findOne({
      organisationId,
      $or: [{ _id: channelId }, { channelId }],
    });

    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    const workspace = await SlackWorkspace.findOne({
      _id: channel.workspaceId,
      organisationId,
      isActive: true,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    if (isClientChannel !== undefined) {
      channel.isClientChannel = Boolean(isClientChannel);
    }
    if (clientId !== undefined) {
      channel.clientId = clientId || null;
    }
    await channel.save();

    if (channel.isClientChannel && channel.clientId) {
      const names = [
        channel.channelId,
        channel.channelName,
        `#${channel.channelName}`,
      ];
      await Client.findOneAndUpdate(
        { _id: channel.clientId, organisationId },
        { $addToSet: { slackChannels: { $each: names } } },
      );

      const slackClient = new WebClient(workspace.accessToken);
      try {
        await slackClient.conversations.join({ channel: channel.channelId });
      } catch (joinErr) {
        const errCode = joinErr?.data?.error;
        if (errCode !== "already_in_channel") {
          console.warn("[slack] conversations.join:", errCode ?? joinErr.message);
        }
      }
    }

    return res.json({
      success: true,
      channel: {
        id: channel._id.toString(),
        channelId: channel.channelId,
        channelName: channel.channelName,
        isClientChannel: channel.isClientChannel,
        clientId: channel.clientId?.toString() ?? null,
      },
    });
  } catch (error) {
    console.error("[slack-oauth] updateChannel:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to update channel",
    });
  }
}

// ── FUNCTION 7 — DELETE /api/slack/workspaces/:workspaceId ───────────────────

/** disconnect — deactivate workspace (export name matches route spec) */
export async function disconnect(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    const { workspaceId } = req.params;

    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const workspace = await SlackWorkspace.findOne({
      _id: workspaceId,
      organisationId,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    const clientChannels = await SlackChannel.find({
      workspaceId: workspace._id,
      isClientChannel: true,
    });

    const slackClient = new WebClient(workspace.accessToken);
    for (const ch of clientChannels) {
      try {
        await slackClient.conversations.leave({ channel: ch.channelId });
      } catch {
        /* optional cleanup */
      }
    }

    workspace.isActive = false;
    await workspace.save();

    await SlackChannel.updateMany(
      { workspaceId: workspace._id },
      { $set: { isClientChannel: false }, $unset: { clientId: 1 } },
    );

    try {
      await removeWorkspace(workspace.teamId);
    } catch (botErr) {
      console.error("[slack-oauth] removeWorkspace:", botErr.message);
    }

    return res.json({
      success: true,
      message: `Disconnected ${workspace.teamName}`,
    });
  } catch (error) {
    console.error("[slack-oauth] disconnect:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to disconnect workspace",
    });
  }
}

export const disconnectWorkspace = disconnect;

/** POST /api/slack/channels/map — bulk client channel mapping (onboarding) */
export async function mapChannelsBulk(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    const { mappings } = req.body ?? {};

    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    if (!Array.isArray(mappings)) {
      return res.status(400).json({ success: false, message: "mappings required" });
    }

    for (const row of mappings) {
      if (!row.clientId) continue;

      const channel = await SlackChannel.findOne({
        organisationId,
        $or: [{ _id: row.id }, { channelId: row.channelId }],
      });

      if (!channel) continue;

      const workspace = await SlackWorkspace.findById(channel.workspaceId);
      if (!workspace?.isActive) continue;

      channel.isClientChannel = true;
      channel.clientId = row.clientId;
      await channel.save();

      const names = [
        channel.channelId,
        channel.channelName,
        `#${channel.channelName}`,
      ];
      await Client.findOneAndUpdate(
        { _id: row.clientId, organisationId },
        { $addToSet: { slackChannels: { $each: names } } },
      );

      const slackClient = new WebClient(workspace.accessToken);
      try {
        await slackClient.conversations.join({ channel: channel.channelId });
      } catch (joinErr) {
        if (joinErr?.data?.error !== "already_in_channel") {
          console.warn("[slack] join:", joinErr.message);
        }
      }
    }

    const monitoredChannelCount = await SlackChannel.countDocuments({
      organisationId,
      isClientChannel: true,
    });

    return res.json({ success: true, monitoredChannelCount });
  } catch (error) {
    console.error("[slack-oauth] mapChannelsBulk:", error);
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to map channels",
    });
  }
}

/** DELETE /api/slack/disconnect — disconnect all workspaces (legacy) */
export async function disconnectAll(req, res) {
  try {
    const organisationId = req.user?.orgId ?? req.user?.organisationId;
    const workspaces = await SlackWorkspace.find({
      organisationId,
      isActive: true,
    });

    for (const ws of workspaces) {
      ws.isActive = false;
      await ws.save();
      try {
        await removeWorkspace(ws.teamId);
      } catch {
        /* ignore */
      }
    }

    await SlackChannel.updateMany(
      { organisationId },
      { $set: { isClientChannel: false }, $unset: { clientId: 1 } },
    );

    return res.json({ success: true, message: "All Slack workspaces disconnected" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to disconnect",
    });
  }
}
