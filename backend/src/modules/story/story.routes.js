// ─────────────────────────────────────────────────────────────────────────────
// story.routes.js — URL paths for Approve / Reject / Edit on the Review Queue
//
// Mounted in app.js at:  /api/stories
//
// Examples (story id = 507f1f77bcf86cd799439011):
//   PATCH /api/stories/507f1f77bcf86cd799439011/approve  → Approve button
//   PATCH /api/stories/507f1f77bcf86cd799439011/reject   → Reject button
//   PATCH /api/stories/507f1f77bcf86cd799439011          → Edit panel Save
//
// Note: POST on approve/reject is kept so SlackMessagesPage (older client) still works.
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";

import { authMiddleware } from "../auth/auth.middleware.js";
import {
  approveStory,
  rejectStory,
  updateStory,
} from "./story.controller.js";

const router = express.Router();

router.use(authMiddleware);

// PATCH /api/stories/:id/approve — BA clicks green Approve on a card
router.patch("/:id/approve", approveStory);

// POST kept for backward compatibility (SlackMessagesPage uses POST today)
router.post("/:id/approve", approveStory);

// PATCH /api/stories/:id/reject — BA clicks Reject
router.patch("/:id/reject", rejectStory);
router.post("/:id/reject", rejectStory);

// PATCH /api/stories/:id — BA saves edits from the slide-in panel
router.patch("/:id", updateStory);

export default router;
