// User.model.js
// MongoDB collection: "users"
// A User = someone who logs into DeliveryPulse (admin, PM, developer, etc.)

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  // Which organisation this user belongs to (multi-tenant isolation)
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },

  // Full name shown in sidebar, assignee lists, and audit trails
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // Login email — unique across the whole app; stored lowercase for consistent lookup
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  // Hashed password only — never store plain text (see pre-save hook below)
  password: {
    type: String,
    required: true,
    minlength: 8,
  },

  // Role controls which screens and actions the user can access
  role: {
    type: String,
    enum: ["admin", "pm", "ba", "developer", "qa"],
    required: true,
  },

  // URL or path to profile image; empty string if no avatar uploaded
  avatar: {
    type: String,
    default: "",
  },

  // Last successful login timestamp (for security / inactive user reports)
  lastLogin: {
    type: Date,
  },

  // Soft-disable account without deleting history
  isActive: {
    type: Boolean,
    default: true,
  },

  // false until user finishes the 3-step onboarding wizard
  onboardingCompleted: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ── Pre-save: auto-hash password ─────────────────────────────
// Runs before every .save() — if password field changed, hash it with bcrypt.
// This auto-hashes password so we never save plain text in MongoDB.
userSchema.pre("save", async function hashPasswordOnSave() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

// ── Instance method: comparePassword ─────────────────────────
// Used in auth service to check login password against the stored hash.
userSchema.methods.comparePassword = async function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── toJSON: strip password from API responses ─────────────────
// Prevents password being sent to frontend accidentally in any JSON response.
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;
