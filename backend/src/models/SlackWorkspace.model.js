// ─────────────────────────────────────────────────────────────────────────────
// SlackWorkspace.model.js — one connected Slack workspace per organisation
//
// Multi-tenant SaaS: a single DeliveryPulse organisation can connect MULTIPLE
// Slack workspaces (e.g. agency + client workspace). Each row stores one OAuth install.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const slackWorkspaceSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Slack workspace ID (T01234567) — unique per organisation, not globally
  teamId: {
    type: String,
    required: true,
  },

  teamName: {
    type: String,
    required: true,
  },

  // e.g. techsolutions.slack.com
  teamDomain: {
    type: String,
  },

  teamIcon: {
    type: String,
  },

  // Bot token (xoxb-…) for this workspace only
  accessToken: {
    type: String,
    required: true,
  },

  botUserId: {
    type: String,
  },

  installedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  connectedAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent duplicate installs of the same Slack team for one org
slackWorkspaceSchema.index({ organisationId: 1, teamId: 1 }, { unique: true });

export default mongoose.model("SlackWorkspace", slackWorkspaceSchema);
