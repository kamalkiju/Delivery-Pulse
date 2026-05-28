// ─────────────────────────────────────────────────────────────────────────────
// story.controller.js — Approve, Reject, and Edit actions from Review Queue
//
// Each function maps to one button on ReviewQueuePage.tsx:
//   approveStory → Approve / Save and Approve
//   rejectStory  → Reject
//   updateStory  → Save Changes (edit panel)
// ─────────────────────────────────────────────────────────────────────────────

import * as storyService from "../../services/story/story.service.js";
import { toReviewStoryDto } from "../review/review.controller.js";

/**
 * approveStory — PATCH /api/stories/:id/approve
 *
 * Called when the BA clicks Approve in the Review Queue.
 *
 * What happens:
 *   1. Find the story by id from the URL (req.params.id)
 *   2. Set status → "approved", approvedBy → logged-in user, approvedAt → now
 *   3. Push work item to Azure DevOps (via story.service)
 *   4. Return the updated story JSON to the frontend
 */
export async function approveStory(req, res) {
  try {
    const storyId = req.params.id;
    const approvedById = req.user?.userId ?? req.user?.id;

    if (!approvedById) {
      return res.status(401).json({
        success: false,
        message: "User id missing from session",
      });
    }

    // story.service also updates ADO + Teams after marking approved
    const story = await storyService.approveStory(storyId, approvedById);

    return res.status(200).json({
      success: true,
      story: toReviewStoryDto({
        ...story.toObject(),
        status: story.status,
      }),
    });
  } catch (error) {
    const status = error.statusCode ?? 500;
    return res.status(status).json({
      success: false,
      message: error.message ?? "Failed to approve story",
    });
  }
}

/**
 * rejectStory — PATCH /api/stories/:id/reject
 *
 * Called when the BA clicks Reject. Story leaves the pending queue.
 */
export async function rejectStory(req, res) {
  try {
    const storyId = req.params.id;

    const story = await storyService.rejectStory(storyId);

    return res.status(200).json({
      success: true,
      story: {
        id: story._id.toString(),
        status: "rejected",
      },
    });
  } catch (error) {
    const status = error.statusCode ?? 500;
    return res.status(status).json({
      success: false,
      message: error.message ?? "Failed to reject story",
    });
  }
}

/**
 * updateStory — PATCH /api/stories/:id
 *
 * Called when the BA saves edits (title, description, type, priority, etc.)
 * from the slide-in edit panel without approving yet.
 */
export async function updateStory(req, res) {
  try {
    const storyId = req.params.id;

    const story = await storyService.updateStory(storyId, req.body);

    return res.status(200).json({
      success: true,
      story: toReviewStoryDto(story),
    });
  } catch (error) {
    const status = error.statusCode ?? 500;
    return res.status(status).json({
      success: false,
      message: error.message ?? "Failed to update story",
    });
  }
}
