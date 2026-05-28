// ─────────────────────────────────────────────────────────────────────────────
// auth.routes.js — URL map for sign-in, sign-up, session, and sign-out
//
// Think of this file as a menu in a restaurant:
//   • The "path" is what the customer orders (e.g. POST /api/auth/login)
//   • The "controller" is the kitchen that cooks the response
//   • "middleware" is the bouncer checking ID before you enter (GET /me)
//
// This router is mounted in app.js as:
//   app.use("/api/auth", authRoutes);
// So every path below is prefixed with /api/auth
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";

import {
  registerController,
  loginController,
  getMeController,
  logoutController,
  completeOnboarding,
  signupStartController,
  signupVerifyEmailController,
  signupSetPasswordController,
  forgotPasswordStartController,
  forgotPasswordVerifyController,
  forgotPasswordResetController,
} from "./auth.controller.js";

import { authMiddleware } from "./auth.middleware.js";

// Router = a mini-app that only handles /api/auth/* URLs
const router = express.Router();

// ── POST /api/auth/register ─────────────────────────────────────────────────
// Creates a new organisation + admin user, returns JWT + user profile.
// Body (JSON): { name, email, password, organisationName? }
// Frontend: SignupPage (/signup) — "Create account" button → signupUser() in auth.api.ts
// After success: user is sent to onboarding or dashboard depending on needsOnboarding.
router.post("/register", registerController);

// Alias kept so older clients calling /signup still work (same handler as /register).
router.post("/signup", registerController);

// Multi-step signup — SignupPage.tsx (email → verify → password → login)
router.post("/signup/start", signupStartController);
router.post("/signup/verify-email", signupVerifyEmailController);
router.post("/signup/set-password", signupSetPasswordController);

// Forgot password — ForgotPasswordPage.tsx
router.post("/forgot-password/start", forgotPasswordStartController);
router.post("/forgot-password/verify", forgotPasswordVerifyController);
router.post("/forgot-password/reset", forgotPasswordResetController);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Checks email + password, returns JWT + user profile.
// Body (JSON): { email, password }
// Frontend: LoginPage (/login) — "Sign In" button → loginUser() in auth.api.ts
// Token is stored in localStorage; axios adds it as Authorization: Bearer <token>.
router.post("/login", loginController);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the currently logged-in user (requires valid JWT).
// No body. Header: Authorization: Bearer <token>
// authMiddleware runs FIRST — if token is missing/invalid, request stops with 401.
// Frontend: OnboardingGate, optional profile/bootstrap → getCurrentUser() in auth.api.ts
router.get("/me", authMiddleware, getMeController);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Tells the API the user is signing out. With JWT there is no server session to
// destroy; the browser must delete the token (Sidebar → logoutUser() in auth.api.ts).
// This endpoint exists so the frontend can call the API for consistency / analytics.
router.post("/logout", logoutController);

// ── POST /api/auth/onboarding/complete (protected) ────────────────────────────
// Marks onboarding wizard finished for req.user.id.
// Frontend: OnboardingPage step 3 → completeOnboardingApi() in auth.api.ts
router.post("/onboarding/complete", authMiddleware, completeOnboarding);

export default router;
