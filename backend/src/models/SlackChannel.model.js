// ─────────────────────────────────────────────────────────────────────────────
// SlackChannel.model.js — channels synced from each connected Slack workspace
//
// User marks isClientChannel + clientId in Settings/onboarding.
// The bot joins client channels and only processes messages from those channels.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const slackChannelSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SlackWorkspace",
    required: true,
  },

  // Slack API channel ID (e.g. C0B6DRBKH62)
  channelId: {
    type: String,
    required: true,
  },

  channelName: {
    type: String,
    required: true,
  },

  isClientChannel: {
    type: Boolean,
    default: false,
  },

  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },

  memberCount: {
    type: Number,
    default: 0,
  },

  isPrivate: {
    type: Boolean,
    default: false,
  },

  addedAt: {
    type: Date,
    default: Date.now,
  },
});

slackChannelSchema.index({ workspaceId: 1, channelId: 1 }, { unique: true });
slackChannelSchema.index({ organisationId: 1, isClientChannel: 1 });

export default mongoose.model("SlackChannel", slackChannelSchema);
