// ─────────────────────────────────────────────────────────────────────────────
// slack.routes.js — Slack OAuth (PKCE) + workspace/channel APIs + messages
// Mounted at: /api/slack (see app.js)
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";

import { authMiddleware } from "../auth/auth.middleware.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  connectInit,
  connect,
  callback,
  getStatus,
  getWorkspaces,
  switchWorkspace,
  getChannels,
  getChannelsLegacy,
  updateChannel,
  disconnect,
  mapChannelsBulk,
  disconnectAll,
} from "./slack-oauth.controller.js";
import { listMessages, getMessageDetail, debugMessages } from "./slack.controller.js";

const router = express.Router();

// ── OAuth ────────────────────────────────────────────────────────────────────
// Step 1: authenticated — generates a short-lived init token and returns the connect URL.
//         The frontend calls this with the JWT in the Authorization header.
router.get("/connect-init", authMiddleware, connectInit);
// Step 2: public — browser redirect from connect-init. Validates the init token,
//         generates PKCE, and redirects to Slack's authorize page.
router.get("/connect", connect);
// callback — PUBLIC: Slack redirects here with ?code= after the user allows the app.
router.get("/callback", callback);

// ── Workspace & channel management (authenticated) ───────────────────────────
router.get("/status", authMiddleware, getStatus);
router.get("/workspaces", authMiddleware, getWorkspaces);
router.post("/workspaces/:workspaceId/switch", authMiddleware, switchWorkspace);
router.get("/channels", authMiddleware, getChannelsLegacy);
router.get("/workspaces/:workspaceId/channels", authMiddleware, getChannels);
router.patch("/channels/:channelId", authMiddleware, updateChannel);
router.delete("/workspaces/:workspaceId", authMiddleware, disconnect);
router.post("/channels/map", authMiddleware, mapChannelsBulk);
router.delete("/disconnect", authMiddleware, disconnectAll);

// ── Slack Messages page ──────────────────────────────────────────────────────
router.use(requireAuth);
router.get("/debug", debugMessages);
router.get("/messages", listMessages);
router.get("/messages/:id", getMessageDetail);

export default router;
