// ─────────────────────────────────────────────────────────────────────────────
// auth.service.js — business logic between HTTP (controller) and MongoDB (models)
//
// The service layer does NOT know about Express req/res.
// It only: queries the database, checks passwords, signs JWTs, returns plain data.
//
// Flow for login:
//   LoginPage → POST /api/auth/login → auth.controller → auth.service.login → User model
// ─────────────────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";

import User from "../../models/User.model.js";
import Organisation from "../../models/Organisation.model.js";
import PendingSignup from "../../models/PendingSignup.model.js";
import PasswordReset from "../../models/PasswordReset.model.js";
import env from "../../config/env.config.js";

const CODE_TTL_MS = 15 * 60 * 1000;
const SIGNUP_TOKEN_TTL = "30m";
const RESET_TOKEN_TTL = "30m";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise email before any MongoDB lookup.
 * User schema stores email lowercase — searching "Raj@X.com" must match "raj@x.com".
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Build a JWT the frontend stores in localStorage after login/register.
 * Payload fields are embedded in the token (not secret — only signed, not encrypted).
 */
function generateToken(user) {
  const payload = {
    userId: user._id.toString(),
    role: user.role,
    orgId: user.organisationId.toString(),
    name: user.name,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

/**
 * Shape a Mongoose user document for API responses (never include password).
 */
function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.organisationId.toString(),
    onboardingCompleted: user.onboardingCompleted ?? false,
    lastLogin: user.lastLogin,
  };
}

// ── login ─────────────────────────────────────────────────────────────────────

/**
 * login(email, password)
 *
 * Called when the user clicks Sign In on LoginPage.
 * Returns { token, user } for the frontend to save and redirect.
 */
export async function login(email, password) {
  const normalizedEmail = normalizeEmail(email);

  // MongoDB query: find ONE document in the "users" collection where email matches.
  // User.findOne({ email }) → db.users.findOne({ email: "raj@techsolutions.com" })
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const err = new Error("User not found with this email");
    err.statusCode = 401;
    throw err;
  }

  // comparePassword is defined on the User schema — bcrypt.compare(typed, hash in DB)
  const passwordMatches = await user.comparePassword(password);

  if (!passwordMatches) {
    const err = new Error("Invalid password");
    err.statusCode = 401;
    throw err;
  }

  // Update lastLogin — tracks when this account last signed in successfully
  user.lastLogin = new Date();
  // .save() writes the document back to MongoDB (runs validators / hooks if any)
  await user.save();

  const token = generateToken(user);

  return {
    token,
    user: toPublicUser(user),
    needsOnboarding: !user.onboardingCompleted,
  };
}

// ── register ──────────────────────────────────────────────────────────────────

/**
 * register(name, email, password, orgName, role)
 *
 * Called when the user creates an account on SignupPage.
 * Creates Organisation + User, then returns JWT like login.
 *
 * Password hashing happens in User.model.js pre-save hook — NOT in this file.
 */
export async function register(name, email, password, orgName, role = "admin") {
  const normalizedEmail = normalizeEmail(email);

  // Check duplicate email before creating anything (avoid orphan organisations)
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    const err = new Error("Email already registered");
    err.statusCode = 409;
    throw err;
  }

  // Step 1 — Create organisation (tenant / workspace) in "organisations" collection
  const organisation = new Organisation({
    name: orgName.trim(),
    industry: "IT Services",
  });
  // Organisation.save() → inserts one document, assigns _id
  await organisation.save();

  // Step 2 — Create user linked to that organisation
  const user = new User({
    name: name.trim(),
    email: normalizedEmail,
    password, // plain text here — pre-save middleware hashes before MongoDB stores it
    role,
    organisationId: organisation._id, // foreign key to the org we just created
  });
  await user.save();

  const token = generateToken(user);

  return {
    token,
    user: toPublicUser(user),
    needsOnboarding: !user.onboardingCompleted,
  };
}

// ── getMe ─────────────────────────────────────────────────────────────────────

/**
 * getMe(userId)
 *
 * Called when the frontend loads to check who is logged in (GET /api/auth/me).
 * userId comes from the JWT payload after authMiddleware verifies the token.
 */
export async function getMe(userId) {
  // findById + select("-password") → fetch user by _id but omit password field from result
  // Equivalent idea: db.users.findOne({ _id: ObjectId(userId) }, { password: 0 })
  const user = await User.findById(userId).select("-password");

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return toPublicUser(user);
}

// ── Multi-step signup (email → verify → password → login) ───────────────────

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createPurposeToken(email, purpose, expiresIn) {
  return jwt.sign({ email, purpose }, env.JWT_SECRET, { expiresIn });
}

function verifyPurposeToken(token, purpose) {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (decoded.purpose !== purpose || !decoded.email) {
    const err = new Error("Invalid session");
    err.statusCode = 400;
    throw err;
  }
  return decoded.email.toLowerCase().trim();
}

function createSignupToken(email) {
  return createPurposeToken(email, "signup", SIGNUP_TOKEN_TTL);
}

function verifySignupToken(signupToken) {
  return verifyPurposeToken(signupToken, "signup");
}

function createResetToken(email) {
  return createPurposeToken(email, "password-reset", RESET_TOKEN_TTL);
}

function verifyResetToken(resetToken) {
  return verifyPurposeToken(resetToken, "password-reset");
}

/** Step 1 — send verification code to email (logged in dev) */
export async function signupStart(email) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const err = new Error("Email already registered");
    err.statusCode = 409;
    throw err;
  }

  const code = generateVerificationCode();
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  await PendingSignup.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      verificationCode: code,
      codeExpiresAt,
      emailVerified: false,
    },
    { upsert: true, new: true },
  );

  if (process.env.NODE_ENV === "development") {
    console.log(`[signup] Verification code for ${normalizedEmail}: ${code}`);
  }

  return {
    email: normalizedEmail,
    message: "Verification code sent to your email",
    devCode: process.env.NODE_ENV === "development" ? code : undefined,
  };
}

/** Step 2 — confirm 6-digit code */
export async function signupVerifyEmail(email, code) {
  const normalizedEmail = normalizeEmail(email);
  const pending = await PendingSignup.findOne({ email: normalizedEmail });

  if (!pending) {
    const err = new Error("No signup in progress for this email");
    err.statusCode = 404;
    throw err;
  }

  if (pending.codeExpiresAt < new Date()) {
    const err = new Error("Verification code expired. Request a new code.");
    err.statusCode = 400;
    throw err;
  }

  if (pending.verificationCode !== code.trim()) {
    const err = new Error("Invalid verification code");
    err.statusCode = 400;
    throw err;
  }

  pending.emailVerified = true;
  await pending.save();

  const signupToken = createSignupToken(normalizedEmail);

  return {
    email: normalizedEmail,
    signupToken,
    message: "Email verified successfully",
  };
}

/** Step 3 — set password and create account (user must login after) */
export async function signupSetPassword({
  signupToken,
  password,
  name,
  orgName,
}) {
  const normalizedEmail = verifySignupToken(signupToken);

  const pending = await PendingSignup.findOne({ email: normalizedEmail });
  if (!pending?.emailVerified) {
    const err = new Error("Email not verified");
    err.statusCode = 400;
    throw err;
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const err = new Error("Email already registered");
    err.statusCode = 409;
    throw err;
  }

  const organisation = new Organisation({
    name: orgName.trim(),
    industry: "IT Services",
  });
  await organisation.save();

  const user = new User({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: "admin",
    organisationId: organisation._id,
    onboardingCompleted: false,
  });
  await user.save();

  await PendingSignup.deleteOne({ email: normalizedEmail });

  return {
    email: normalizedEmail,
    message: "Account created successfully. Please sign in.",
  };
}

// ── Forgot password (email → verify → reset → login) ──────────────────────────

export async function forgotPasswordStart(email) {
  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const err = new Error("No account found with this email");
    err.statusCode = 404;
    throw err;
  }

  const code = generateVerificationCode();
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  await PasswordReset.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      verificationCode: code,
      codeExpiresAt,
      emailVerified: false,
    },
    { upsert: true, new: true },
  );

  if (process.env.NODE_ENV === "development") {
    console.log(`[forgot-password] Code for ${normalizedEmail}: ${code}`);
  }

  return {
    email: normalizedEmail,
    message: "Password reset code sent to your email",
    devCode: process.env.NODE_ENV === "development" ? code : undefined,
  };
}

export async function forgotPasswordVerify(email, code) {
  const normalizedEmail = normalizeEmail(email);
  const pending = await PasswordReset.findOne({ email: normalizedEmail });

  if (!pending) {
    const err = new Error("No password reset in progress for this email");
    err.statusCode = 404;
    throw err;
  }

  if (pending.codeExpiresAt < new Date()) {
    const err = new Error("Verification code expired. Request a new code.");
    err.statusCode = 400;
    throw err;
  }

  if (pending.verificationCode !== code.trim()) {
    const err = new Error("Invalid verification code");
    err.statusCode = 400;
    throw err;
  }

  pending.emailVerified = true;
  await pending.save();

  return {
    email: normalizedEmail,
    resetToken: createResetToken(normalizedEmail),
    message: "Email verified. You can set a new password.",
  };
}

export async function forgotPasswordReset({
  resetToken,
  password,
}) {
  const normalizedEmail = verifyResetToken(resetToken);

  const pending = await PasswordReset.findOne({ email: normalizedEmail });
  if (!pending?.emailVerified) {
    const err = new Error("Email not verified");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  user.password = password;
  await user.save();

  await PasswordReset.deleteOne({ email: normalizedEmail });

  return {
    email: normalizedEmail,
    message: "Password updated. Please sign in with your new password.",
  };
}

// ── Other auth flows (used by existing routes) ────────────────────────────────

/** Mark onboarding wizard complete for this user */
export async function completeOnboarding(userId) {
  const user = await User.findByIdAndUpdate(
    userId,
    { onboardingCompleted: true },
    { new: true },
  ).select("-password");

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return toPublicUser(user);
}

// Aliases kept so older imports still work
export const signup = register;
export const getUserById = getMe;
