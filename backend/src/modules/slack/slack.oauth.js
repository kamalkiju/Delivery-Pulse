// ─────────────────────────────────────────────────────────────────────────────
// slack.oauth.js — helpers for Slack OAuth 2.0 (used by slack.controller.js)
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";

/** Scopes the DeliveryPulse bot needs (comma-separated for Slack authorize URL) */
export const SLACK_OAUTH_SCOPES = [
  "channels:history",
  "channels:read",
  "chat:write",
  "files:read",
  "users:read",
  "groups:history",
  "im:write",
  "channels:join",
].join(",");

/**
 * Pack organisationId + userId into the OAuth `state` param.
 * Slack returns this unchanged so we know which org to save the token for.
 */
export function encodeOAuthState({ organisationId, userId, returnTo = "settings" }) {
  const payload = JSON.stringify({ organisationId, userId, returnTo });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeOAuthState(state) {
  if (!state) return null;
  try {
    let json;
    try {
      json = Buffer.from(state, "base64url").toString("utf8");
    } catch {
      json = Buffer.from(state, "base64").toString("utf8");
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Base64 state (spec) — also supported by decodeOAuthState */
export function encodeOAuthStateBase64({ organisationId, userId, returnTo = "settings" }) {
  return Buffer.from(
    JSON.stringify({ organisationId, userId, returnTo }),
    "utf8",
  ).toString("base64");
}

/** Build the URL that opens Slack’s “Allow” screen (same params as connect()) */
export function buildSlackAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    scope:
      "channels:history,channels:read,chat:write,files:read,users:read,groups:history,im:write",
    redirect_uri: process.env.SLACK_REDIRECT_URI,
    state,
    response_type: "code",
    granular_bot_scope: "0",
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange the temporary `code` from Slack for a permanent bot token.
 * POST https://slack.com/api/oauth.v2.access
 */
export async function exchangeCodeForToken(code) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const { data } = await axios.post(
    "https://slack.com/api/oauth.v2.access",
    body.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  if (!data.ok) {
    const err = new Error(data.error ?? "Slack OAuth token exchange failed");
    err.slackError = data.error;
    throw err;
  }

  return data;
}
