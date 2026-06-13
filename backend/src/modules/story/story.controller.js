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

const getActiveAdoConnection = async (organisationId) => {
  try {
    const AdoConnection = (await import("../../models/AdoConnection.model.js")).default;

    let connection = await AdoConnection.findOne({
      organisationId,
      isDefault: true,
      isActive: true,
      connectionStatus: "connected",
    });

    if (!connection) {
      connection = await AdoConnection.findOne({
        organisationId,
        isActive: true,
        connectionStatus: "connected",
      });
    }

    if (!connection) {
      connection = await AdoConnection.findOne({
        isActive: true,
        connectionStatus: "connected",
      });
    }

    if (connection) {
      return {
        org: connection.adoOrg,
        project: connection.adoProject,
        token: connection.patToken,
        workItemTypes: connection.workItemTypes,
      };
    }

    if (process.env.ADO_ORG && process.env.ADO_PROJECT && process.env.ADO_TOKEN) {
      return {
        org: process.env.ADO_ORG,
        project: process.env.ADO_PROJECT,
        token: process.env.ADO_TOKEN,
        workItemTypes: [],
      };
    }

    return null;
  } catch (error) {
    console.error("[ado-conn] getActiveAdoConnection error:", error.message);
    return null;
  }
};

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
    if (status === "approved") {
      filter.status = { $in: ["approved", "pushed-to-ado"] };
    } else if (status) {
      filter.status = status;
    }
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

    console.log("[approve] Story found:", story.storyTitle);
    console.log("[approve] Checking ADO env vars...");
    console.log("[approve] ADO_ORG:", process.env.ADO_ORG || "NOT SET");
    console.log("[approve] ADO_PROJECT:", process.env.ADO_PROJECT || "NOT SET");
    console.log("[approve] ADO_TOKEN:", process.env.ADO_TOKEN ? "SET" : "NOT SET");

    story.status = "approved";
    story.approvedAt = new Date();

    let adoId = null;
    let adoUrl = null;

    const adoConfig = await getActiveAdoConnection(getOrgId(req));

    console.log(
      "[approve] ADO config from DB:",
      adoConfig ? `${adoConfig.org}/${adoConfig.project}` : "NOT FOUND",
    );

    if (adoConfig) {
      process.env.ADO_ORG = adoConfig.org;
      process.env.ADO_PROJECT = adoConfig.project;
      process.env.ADO_TOKEN = adoConfig.token;

      console.log("[approve] ADO configured - attempting push...");
      try {
        const adoModule = await import("../../services/ado/ado.service.js");
        const createADOWorkItem =
          adoModule.createADOWorkItem || adoModule.default?.createADOWorkItem;

        console.log("[approve] createADOWorkItem function:", typeof createADOWorkItem);

        if (typeof createADOWorkItem !== "function") {
          throw new Error("createADOWorkItem is not exported from ado.service.js");
        }

        adoId = await createADOWorkItem(story);

        console.log("[approve] ADO work item created:", adoId);

        story.adoId = String(adoId);
        story.status = "pushed-to-ado";
        adoUrl = `https://dev.azure.com/${adoConfig.org}/${encodeURIComponent(adoConfig.project)}/_workitems/edit/${adoId}`;
        story.adoUrl = adoUrl;
      } catch (adoError) {
        console.error("[approve] ADO push FAILED:", adoError.message);
        console.error("[approve] ADO error stack:", adoError.stack);
      }
    } else {
      console.log("[approve] ADO NOT configured - no connection in DB or env vars");
    }

    await story.save();
    console.log("[approve] Story saved with status:", story.status);

    if (story.assignee) {
      try {
        const { sendTeamsNotification } = await import(
          "../../services/teams/teams.service.js"
        );

        const User = (await import("../../models/User.model.js")).default;
        const approver = await User.findById(req.user.userId ?? req.user.id);

        await sendTeamsNotification({
          assigneeName: story.assigneeName || story.assignee,
          assigneeEmail: story.assignee,
          storyTitle: story.storyTitle || story.title,
          description: story.description,
          priority: story.priority,
          type: story.type,
          sprint: story.sprint,
          acceptanceCriteria: story.acceptanceCriteriaFormatted
            || story.acceptanceCriteria || [],
          adoId,
          adoUrl,
          tags: story.tags || [],
          approvedBy: approver?.name || approver?.email || "BA",
          clientName: story.clientId?.name || "Client",
        });

        console.log("[approve] Teams notification sent");
      } catch (teamsError) {
        console.error("[approve] Teams notification failed:", teamsError.message);
      }
    }

    res.json({
      success: true,
      adoId,
      adoUrl,
      message: adoId
        ? `Approved and pushed to ADO #${adoId}`
        : "Story approved",
    });
  } catch (error) {
    console.error("[approve] Critical error:", error);
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
