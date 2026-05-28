// PendingSignup — holds email + verification code until password is set
// Deleted after account is created or when a new code is requested for the same email

import mongoose from "mongoose";

const pendingSignupSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  verificationCode: {
    type: String,
    required: true,
  },
  codeExpiresAt: {
    type: Date,
    required: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PendingSignup = mongoose.model("PendingSignup", pendingSignupSchema);

export default PendingSignup;
