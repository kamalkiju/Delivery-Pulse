// ─────────────────────────────────────────────────────────────────────────────
// story.controller.js — Approve, Reject, and Edit actions from Review Queue
//
// Each function maps to one button on ReviewQueuePage.tsx:
//   approveStory → Approve / Save and Approve
//   rejectStory  → Reject
//   updateStory  → Save Changes (edit panel)
// ─────────────────────────────────────────────────────────────────────────────

import Story from "../../models/Story.model.js";
import SlackWorkspace from "../../models/SlackWorkspace.model.js";
import * as storyService from "../../services/story/story.service.js";
import { toReviewStoryDto } from "../review/review.controller.js";

const getOrgId = (req) => req.user?.orgId ?? req.user?.organisationId;

/** GET /api/stories — list stories with optional status/source/projectId filters */
export async function getStories(req, res) {
  try {
    const organisationId = getOrgId(req);
    const { status, source, projectId } = req.query;

    const workspaces = await SlackWorkspace.find({ isActive: true }).select("organisationId").lean();
    const orgIds = [
      ...new Set([
        organisationId.toString(),
        ...workspaces.map((w) => w.organisationId?.toString()).filter(Boolean),
      ]),
    ];

    const filter = { organisationId: { $in: orgIds } };
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (projectId) filter.projectId = projectId;

    const stories = await Story.find(filter)
      .populate("clientId", "name company")
      .populate("projectId", "name color")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, stories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * approveStory — PATCH /api/stories/:id/approve
 *
 * Approves the story and pushes to Azure DevOps when configured.
 */
export const approveStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)
      .populate("clientId");

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    story.status = "approved";
    story.approvedAt = new Date();

    let adoId = null;
    let adoUrl = null;

    const adoOrg = process.env.ADO_ORG;
    const adoProject = process.env.ADO_PROJECT;
    const adoToken = process.env.ADO_TOKEN;

    console.log("[approve] ADO configured:",
      adoOrg ? "YES" : "NO",
      adoProject ? "YES" : "NO",
      adoToken ? "YES" : "NO",
    );

    if (adoOrg && adoProject && adoToken) {
      try {
        const { createADOWorkItem } = await import(
          "../../services/ado/ado.service.js"
        );
        adoId = await createADOWorkItem(story);
        story.adoId = String(adoId);
        story.status = "pushed-to-ado";
        adoUrl = `https://dev.azure.com/${adoOrg}/${encodeURIComponent(adoProject)}/_workitems/edit/${adoId}`;
        story.adoUrl = adoUrl;
        console.log("[approve] ADO work item created:", adoId);
      } catch (adoError) {
        console.error("[approve] ADO failed:", adoError.message);
      }
    }

    await story.save();

    res.json({
      success: true,
      adoId,
      adoUrl,
      message: adoId
        ? `Approved and pushed to ADO #${adoId}`
        : "Story approved",
    });
  } catch (error) {
    console.error("[approve] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

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

/** DELETE /api/stories/delete-documents — temporary testing cleanup */
export const deleteDocumentStories = async (req, res) => {
  try {
    const result = await Story.deleteMany({ source: "document" });
    console.log("[stories] Deleted", result.deletedCount, "document stories");
    res.json({
      success: true,
      deleted: result.deletedCount,
      message: `Deleted ${result.deletedCount} document stories`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /api/stories/:id */
export const deleteStory = async (req, res) => {
  try {
    await Story.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Story deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /api/stories/delete-by-source/:source */
export const deleteBySource = async (req, res) => {
  try {
    const result = await Story.deleteMany({ source: req.params.source });
    res.json({
      success: true,
      deleted: result.deletedCount,
      message: `Deleted ${result.deletedCount} stories`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
