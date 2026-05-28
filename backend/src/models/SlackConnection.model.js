// ─────────────────────────────────────────────────────────────────────────────
// SlackConnection.model.js — one Slack workspace linked to one organisation
//
// Created when a user completes “Connect Slack” OAuth in onboarding or Settings.
// Stores the bot token Slack gives us so DeliveryPulse can read channels and post replies.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const slackConnectionSchema = new mongoose.Schema({
  // Which DeliveryPulse organisation owns this Slack workspace (one-to-one)
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
    unique: true,
  },

  // Bot token (xoxb-…) — used to call Slack Web API for this workspace
  accessToken: {
    type: String,
    required: true,
  },

  // Same token in OAuth v2 installs; kept for clarity / future user-token flows
  botToken: {
    type: String,
    required: true,
  },

  // Slack workspace ID (e.g. T01234567) — maps incoming events to the right org
  teamId: {
    type: String,
    required: true,
  },

  // Human-readable workspace name (e.g. "TechSolutions")
  teamName: {
    type: String,
    required: true,
  },

  // Workspace icon URL from Slack team.info (shown in onboarding)
  teamIcon: {
    type: String,
  },

  // Slack user ID of the bot (B01234567)
  botUserId: {
    type: String,
  },

  // DeliveryPulse user who clicked “Allow” in Slack
  installedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  connectedAt: {
    type: Date,
    default: Date.now,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

export default mongoose.model("SlackConnection", slackConnectionSchema);
