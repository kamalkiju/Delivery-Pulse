// Client.model.js
// MongoDB collection: "clients"
// A Client = an end-customer your organisation delivers software for (e.g. TechCorp)

import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  // Owner organisation — every client belongs to one DeliveryPulse tenant
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Short client name used in tables and health dashboards
  name: {
    type: String,
    required: true,
  },

  // Legal or trading company name on contracts
  company: {
    type: String,
    required: true,
  },

  // Primary contact email for notifications
  email: {
    type: String,
  },

  // Contract value as String so UI can show "₹50L" or "$1.2M" without number parsing
  contractValue: {
    type: String,
  },

  // Active project or engagement name
  projectName: {
    type: String,
  },

  // Slack channels monitored for this client (e.g. "#client-techcorp")
  slackChannels: {
    type: [String],
    default: [],
  },

  // Overall health 0–100; Number allows sorting and colour thresholds in UI
  healthScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
  },

  // Traffic-light status derived from healthScore and SLA rules
  status: {
    type: String,
    enum: ["healthy", "at-risk", "critical"],
    default: "healthy",
  },

  // Last time we saw Slack, meeting, or story activity for this client
  lastActivity: {
    type: Date,
    default: Date.now,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Client = mongoose.model("Client", clientSchema);

export default Client;
