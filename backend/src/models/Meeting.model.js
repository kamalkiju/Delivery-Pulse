// Meeting.model.js
// MongoDB collection: "meetings"
// A Meeting = recorded client call (Teams/Zoom) with transcript and AI summary

import mongoose from "mongoose";

// Sub-document: one person on the attendee list
const attendeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String },
    isClient: { type: Boolean, default: false },
  },
  { _id: false },
);

const meetingSchema = new mongoose.Schema({
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
  },

  // Meeting title from calendar or Teams
  title: {
    type: String,
    required: true,
  },

  // When the meeting happened
  meetingDate: {
    type: Date,
    required: true,
  },

  // Length in minutes — Number for charts and averages
  duration: {
    type: Number,
  },

  // Who attended — name, role, and whether they are from the client side
  attendees: {
    type: [attendeeSchema],
    default: [],
  },

  // Full transcript text from speech-to-text
  transcript: {
    type: String,
  },

  // AI-generated bullet summary shown on meeting detail page
  aiSummary: {
    type: [String],
    default: [],
  },

  // Count of stories auto-created from this meeting
  storiesCreated: {
    type: Number,
    default: 0,
  },

  // Count of verbal commitments detected
  commitmentCount: {
    type: Number,
    default: 0,
  },

  // Pipeline state while transcript/AI runs
  status: {
    type: String,
    enum: ["processing", "completed", "failed"],
    default: "processing",
  },

  // Microsoft Teams meeting ID for sync
  teamsId: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;
