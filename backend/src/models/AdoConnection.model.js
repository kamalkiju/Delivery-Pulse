import mongoose from "mongoose";

const { Schema, model } = mongoose;

const AdoConnectionSchema = new Schema({
  organisationId: {
    type: Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },
  name: { type: String, required: true },
  adoOrg: { type: String, required: true },
  adoProject: { type: String, required: true },
  patToken: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  connectionStatus: {
    type: String,
    enum: ["connected", "failed", "pending"],
    default: "pending",
  },
  lastTestedAt: { type: Date },
  workItemTypes: { type: [String], default: [] },
  projectId: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export default model("AdoConnection", AdoConnectionSchema);
