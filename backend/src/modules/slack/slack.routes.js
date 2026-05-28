// ─────────────────────────────────────────────────────────────────────────────
// slack.routes.js — Slack OAuth (PKCE) + workspace/channel APIs + messages
// Mounted at: /api/slack (see app.js)
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";

import { authMiddleware } from "../auth/auth.middleware.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { slackConnectAuth } from "./slack.connect.middleware.js";
import {
  connect,
  callback,
  getStatus,
  getWorkspaces,
  getChannels,
  getChannelsLegacy,
  updateChannel,
  disconnect,
  mapChannelsBulk,
  disconnectAll,
} from "./slack-oauth.controller.js";
import { listMessages, getMessageDetail } from "./slack.controller.js";

const router = express.Router();

// ── OAuth ────────────────────────────────────────────────────────────────────
// connect — JWT via Bearer header or ?token= (browser link)
router.get("/connect", slackConnectAuth, connect);
// callback — PUBLIC: Slack redirects here without a JWT
router.get("/callback", callback);

// ── Workspace & channel management (authenticated) ───────────────────────────
router.get("/status", authMiddleware, getStatus);
router.get("/workspaces", authMiddleware, getWorkspaces);
router.get("/channels", authMiddleware, getChannelsLegacy);
router.get("/workspaces/:workspaceId/channels", authMiddleware, getChannels);
router.patch("/channels/:channelId", authMiddleware, updateChannel);
router.delete("/workspaces/:workspaceId", authMiddleware, disconnect);
router.post("/channels/map", authMiddleware, mapChannelsBulk);
router.delete("/disconnect", authMiddleware, disconnectAll);

// ── Slack Messages page ──────────────────────────────────────────────────────
router.use(requireAuth);
router.get("/messages", listMessages);
router.get("/messages/:id", getMessageDetail);

export default router;
