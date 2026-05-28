// Organisation.model.js
// MongoDB collection name: "organisations" (Mongoose lowercases and pluralises the model name)
// One Organisation = one DeliveryPulse customer company (your tenant / workspace)

import mongoose from "mongoose";

const organisationSchema = new mongoose.Schema({
  // Company display name shown in the app header and settings
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // Industry category — used for reporting and onboarding defaults
  industry: {
    type: String,
    enum: ["IT Services", "SaaS", "Consulting", "Other"],
  },

  // Rough team size label (e.g. "10-50") — String keeps it flexible for UI copy
  teamSize: {
    type: String,
  },

  // Primary country for contracts and timezone defaults
  country: {
    type: String,
    default: "India",
  },

  // When this organisation record was created in DeliveryPulse
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Register model: "Organisation" → collection "organisations"
const Organisation = mongoose.model("Organisation", organisationSchema);

export default Organisation;
