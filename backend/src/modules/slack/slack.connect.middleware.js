// ─────────────────────────────────────────────────────────────────────────────
// slack.connect.middleware.js — auth for GET /api/slack/connect
//
// Browsers cannot send Authorization headers on a normal link click.
// So we accept either:
//   • Authorization: Bearer <jwt>  (API clients)
//   • ?token=<jwt> on the URL       (Connect Slack button in React)
// ─────────────────────────────────────────────────────────────────────────────

import { authMiddleware } from "../auth/auth.middleware.js";

export function slackConnectAuth(req, res, next) {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return authMiddleware(req, res, next);
  }

  const queryToken = req.query.token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    req.headers.authorization = `Bearer ${queryToken}`;
    return authMiddleware(req, res, next);
  }

  return res.status(401).json({
    success: false,
    message: "Login required before connecting Slack.",
  });
}
