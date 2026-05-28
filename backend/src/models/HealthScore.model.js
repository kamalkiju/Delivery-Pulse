// HealthScore.model.js
// MongoDB collection: "healthscores"
// Point-in-time health snapshot for a client — used for trends and charts
//
// Scoring breakdown (max 100):
//   responseScore  — 0–30 pts (how fast you reply on Slack/email)
//   deliveryScore  — 0–40 pts (on-time delivery, sprint completion)
//   issueScore     — 0–30 pts (open bugs, escalations, SLA breaches)
//   score          — sum of the three (stored for quick reads)

import mongoose from "mongoose";

const healthScoreSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },

  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Total health 0–100
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },

  responseScore: {
    type: Number,
    min: 0,
    max: 30,
  },

  deliveryScore: {
    type: Number,
    min: 0,
    max: 40,
  },

  issueScore: {
    type: Number,
    min: 0,
    max: 30,
  },

  calculatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Fast lookup: latest scores per client, sorted by time
healthScoreSchema.index({ clientId: 1, calculatedAt: -1 });

const HealthScore = mongoose.model("HealthScore", healthScoreSchema);

export default HealthScore;
