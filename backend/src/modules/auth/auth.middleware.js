// ─────────────────────────────────────────────────────────────────────────────
// auth.middleware.js — security gate before protected API routes
//
// What is middleware?
//   Express runs a chain of functions for each request. This file is one link
//   in that chain. It runs BEFORE the controller (e.g. getMeController).
//
//   Request journey:
//     Browser → authMiddleware (check JWT) → controller → JSON response
//
// This file runs before every protected API call, for example:
//   GET  /api/auth/me
//   POST /api/auth/onboarding/complete
//   GET  /api/dashboard/*  (via requireAuth alias in other route files)
//
// Frontend: axios interceptor in src/api/axios.ts adds the header:
//   Authorization: Bearer <token from localStorage after login>
// ─────────────────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";

import env from "../../config/env.config.js";

/**
 * authMiddleware — verify JWT and attach decoded user to req.user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function authMiddleware(req, res, next) {
  // ── Step 1 — Read the Authorization header ───────────────────────────────
  // The frontend sends: Authorization: "Bearer eyJhbGciOiJIUzI1NiIs..."
  // "Bearer" is a standard prefix meaning "here is a token credential".
  const authHeader = req.headers.authorization;

  // ── Step 2 — Reject requests with no Bearer token ─────────────────────────
  // 401 Unauthorized = "we don't know who you are" — user must log in again.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Please login first.",
    });
  }

  // ── Step 3 — Extract the raw JWT string ───────────────────────────────────
  // authHeader.split(" ") → ["Bearer", "eyJhbG..."]
  // [1] takes the second piece (the token only, without the word "Bearer").
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token provided. Please login first.",
    });
  }

  // ── Step 4 — Verify signature and expiry ──────────────────────────────────
  // jwt.verify checks:
  //   • token was signed with our JWT_SECRET (not forged)
  //   • token is not past its expiresIn date
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // ── Step 5 — Attach user info for controllers ───────────────────────────
    // decoded payload matches auth.service.js sign(): userId, role, orgId, name
    // Controllers read req.user.userId, req.user.role, etc.
    // id alias supports older tokens that used "id" instead of "userId".
    req.user = {
      ...decoded,
      id: decoded.userId ?? decoded.id,
    };

    // ── Step 6 — Hand off to the route handler ──────────────────────────────
    // next() tells Express: "middleware passed — run getMeController (or next link)".
    return next();
  } catch (error) {
    // 401 again — token was present but not acceptable
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token. Please login again.",
    });
  }
}
