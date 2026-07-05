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

  // Which client this story relates to (optional — document uploads may not have a client)
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },

  // Enterprise story title in HUB>1>INC[n]>[feature] format
  storyTitle: {
    type: String,
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

  // "As a... I need... So that..." user story statement
  descriptionStatement: {
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
      "in-progress",
      "resolved",
      "done",
    ],
    default: "pending-review",
  },

  // List of "given/when/then" or bullet criteria (flat strings, legacy)
  acceptanceCriteria: {
    type: [String],
    default: [],
  },

  // Structured AC objects: { id, given, when, then }
  acceptanceCriteriaFormatted: {
    type: [
      {
        id: String,
        scenario: String,
        given: String,
        when: String,
        then: String,
      },
    ],
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
    default: null,
  },

  adoUrl: {
    type: String,
    default: null,
  },

  adoStatus: {
    type: String,
    default: null,
  },

  lastSyncedAt: {
    type: Date,
    default: null,
  },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },

  epicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Epic",
    default: null,
  },

  epicName: {
    type: String,
    default: null,
  },

  featureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Feature",
    default: null,
  },

  featureName: {
    type: String,
    default: null,
  },

  releaseNotes: {
    type: String,
    default: "",
  },

  sprint: {
    type: String,
    default: "Backlog",
  },

  areaPath: {
    type: String,
  },

  tags: {
    type: [String],
    default: [],
  },

  figmaLink: {
    type: String,
  },

  userFlow: {
    type: String,
  },

  uiBehavior: {
    type: String,
  },

  businessRequirement: {
    type: String,
  },

  validations: {
    type: [String],
    default: [],
  },

  // Display name or email of assignee (can link to User later)
  assignee: {
    type: String,
  },

  assigneeName: {
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

  // Document upload order — preserves epic sequence in Review Queue
  sequence: {
    type: Number,
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
