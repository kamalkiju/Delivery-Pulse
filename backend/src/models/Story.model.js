// Story.model.js
// MongoDB collection: "stories"
// A Story = a work item (bug, feature, task) — often created by AI from Slack, docs, or meetings

import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Which client this story relates to
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true,
  },

  // Short title shown in review queue and ADO
  title: {
    type: String,
    required: true,
  },

  // Full description / acceptance context
  description: {
    type: String,
  },

  // Work item type — maps to ADO work item types
  type: {
    type: String,
    enum: ["Bug", "Story", "Task", "Feature"],
    required: true,
  },

  priority: {
    type: String,
    enum: ["Critical", "High", "Medium", "Low"],
    default: "Medium",
  },

  // Review workflow before pushing to Azure DevOps
  status: {
    type: String,
    enum: [
      "pending-review",
      "approved",
      "rejected",
      "pushed-to-ado",
      "done",
    ],
    default: "pending-review",
  },

  // List of "given/when/then" or bullet criteria
  acceptanceCriteria: {
    type: [String],
    default: [],
  },

  // Where the story came from — drives UI icons and audit trail
  source: {
    type: String,
    enum: ["slack", "document", "meeting", "manual"],
    required: true,
  },

  // ID of the source record: Slack ts, document filename, or meeting _id
  sourceRef: {
    type: String,
  },

  // Original client wording that AI used to draft this story (quote for PM review)
  sourceQuote: {
    type: String,
  },

  // Azure DevOps work item ID after push
  adoId: {
    type: String,
  },

  sprint: {
    type: String,
  },

  // Display name or email of assignee (can link to User later)
  assignee: {
    type: String,
  },

  // True when Claude/AI created the draft; false for manual entry
  isAIGenerated: {
    type: Boolean,
    default: true,
  },

  // If this story is a regression of a previous one, link to parent Story
  regressionOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Story",
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  approvedAt: {
    type: Date,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Keep updatedAt in sync whenever the document is saved
storySchema.pre("save", function touchUpdatedAt(next) {
  this.updatedAt = Date.now();
  next();
});

const Story = mongoose.model("Story", storySchema);

export default Story;
