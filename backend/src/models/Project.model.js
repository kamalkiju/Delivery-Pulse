import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ProjectSchema = new Schema({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  clientId: { type: Schema.Types.ObjectId, ref: "Client" },
  color: { type: String, default: "#0088ff" },
  status: { type: String, enum: ["active", "archived"], default: "active" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

export default model("Project", ProjectSchema);
