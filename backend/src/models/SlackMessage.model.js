// SlackMessage.model.js
// MongoDB collection: "slackmessages"
// Stores one message ingested from Slack — used for AI story extraction and audit

import mongoose from "mongoose";

const slackMessageSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Slack workspace ID (T01234567) — ties message to one OAuth-connected workspace
  teamId: {
    type: String,
  },

  // Optional link to Client when channel is mapped to a customer
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },

  // Slack API channel ID (e.g. C01234567) — stable identifier
  channelId: {
    type: String,
    required: true,
  },

  // Human-readable channel name (e.g. "#client-techcorp")
  channelName: {
    type: String,
  },

  // Slack user ID of sender (U01234567)
  senderId: {
    type: String,
  },

  // Resolved display name from Slack users.info
  senderName: {
    type: String,
  },

  // Email when available — helps detect internal vs client
  senderEmail: {
    type: String,
  },

  // true = message from client/external guest; false = your team
  isExternal: {
    type: Boolean,
    default: false,
  },

  // Plain text body of the message
  messageText: {
    type: String,
  },

  // Whether the message included a screenshot or image file
  hasImage: {
    type: Boolean,
    default: false,
  },

  // Public or signed URL to stored image
  imageUrl: {
    type: String,
  },

  // Optional inline image for small screenshots (processing pipeline)
  imageBase64: {
    type: String,
  },

  // Slack thread timestamp — reply in same thread when bot responds
  threadTs: {
    type: String,
  },

  // Whether AI has already turned this message into a story draft
  aiProcessed: {
    type: Boolean,
    default: false,
  },

  // Link to generated Story after approval pipeline
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Story",
  },

  // Whether the bot posted an auto-reply in the thread
  autoReplySent: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SlackMessage = mongoose.model("SlackMessage", slackMessageSchema);

export default SlackMessage;
