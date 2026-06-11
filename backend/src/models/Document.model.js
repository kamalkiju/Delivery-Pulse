// Document.model.js
// MongoDB collection: "documents"
// A Document = uploaded file (SOW, spreadsheet) processed into stories

import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },

  // Original filename as uploaded by the user
  originalName: {
    type: String,
    required: true,
  },

  fileType: {
    type: String,
    enum: ["docx", "xlsx", "xls", "pdf", "txt", "csv"],
    required: true,
  },

  filePath: {
    type: String,
    default: "",
  },

  // Size in bytes — for upload limits UI
  fileSize: {
    type: Number,
  },

  // For spreadsheets — how many rows were parsed
  rowCount: {
    type: Number,
  },

  storiesCreated: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ["uploaded", "processing", "processed", "failed"],
    default: "uploaded",
  },

  // 0–100 progress bar while AI parses the file
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  uploadedByName: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model("Document", documentSchema);

export default Document;
