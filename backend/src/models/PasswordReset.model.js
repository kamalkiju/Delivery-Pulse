// PasswordReset — stores verification codes for forgot-password flow

import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
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

const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

export default PasswordReset;
