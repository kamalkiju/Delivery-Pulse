// Commitment.model.js
// MongoDB collection: "commitments"
// A Commitment = something someone promised in a meeting ("we'll ship by Friday")

import mongoose from "mongoose";

const commitmentSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Source meeting where the promise was detected
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meeting",
  },

  // Who made the commitment (display name from transcript)
  personName: {
    type: String,
    required: true,
  },

  personRole: {
    type: String,
  },

  // What they promised to do
  commitmentText: {
    type: String,
    required: true,
  },

  dueDate: {
    type: Date,
  },

  status: {
    type: String,
    enum: ["open", "done", "overdue"],
    default: "open",
  },

  // Whether we already sent a Slack/email reminder
  reminderSent: {
    type: Boolean,
    default: false,
  },

  // When AI or rules engine flagged this commitment
  detectedAt: {
    type: Date,
    default: Date.now,
  },
});

const Commitment = mongoose.model("Commitment", commitmentSchema);

export default Commitment;
