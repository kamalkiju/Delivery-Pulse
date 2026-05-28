// ─────────────────────────────────────────────────────────────────────────────
// review.routes.js — URL paths for the Review Queue screen
//
// HOW EXPRESS ROUTING WORKS (beginner-friendly):
//   1. app.js mounts this file at  /api/review
//   2. Each router.get/post/patch below is RELATIVE to that prefix
//   3. So router.get("/") becomes the full URL:  GET http://localhost:5000/api/review
//
// FLOW FOR ONE REQUEST:
//   Browser (ReviewQueuePage) → authMiddleware → controller → MongoDB → JSON
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";

// Security: only logged-in users may load the review queue
import { authMiddleware } from "../auth/auth.middleware.js";

// Controller = the function that actually loads stories from the database
import { getReviewQueue } from "./review.controller.js";

const router = express.Router();

// Every route in this file runs authMiddleware first (same pattern as login gate)
router.use(authMiddleware);

// GET /api/review — list all stories waiting for BA approval
router.get("/", getReviewQueue);

export default router;
