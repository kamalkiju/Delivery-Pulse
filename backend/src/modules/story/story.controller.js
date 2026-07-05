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

const getAllOrgIds = async () => {
  try {
    const workspaces = await SlackWorkspace.find({});
    return [...new Set(workspaces.map((w) => w.organisationId?.toString()).filter(Boolean))];
  } catch {
    return [];
  }
};

/** GET /api/stories/epics-list — epics for edit panel dropdown */
export const getEpicsList = async (req, res) => {
  try {
    const Epic = (await import("../../models/Epic.model.js")).default;

    const orgIds = await getAllOrgIds();
    const userOrgId = (req.user?.organisationId ?? req.user?.orgId)?.toString();
    if (userOrgId && !orgIds.includes(userOrgId)) orgIds.push(userOrgId);

    const epics = await Epic.find({
      organisationId: { $in: orgIds },
    }).sort({ name: 1 });

    res.json({ success: true, epics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** GET /api/stories/features-list — features for edit panel dropdown */
export const getFeaturesList = async (req, res) => {
  try {
    const Feature = (await import("../../models/Feature.model.js")).default;

    const { epicId } = req.query;

    const orgIds = await getAllOrgIds();
    const userOrgId = (req.user?.organisationId ?? req.user?.orgId)?.toString();
    if (userOrgId && !orgIds.includes(userOrgId)) orgIds.push(userOrgId);

    const filter = { organisationId: { $in: orgIds } };
    if (epicId) filter.epicId = epicId;

    const features = await Feature.find(filter)
      .populate("epicId", "name")
      .sort({ name: 1 });

    res.json({ success: true, features });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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
      console.log("[approve] ADO configured - attempting push...");
      try {
        const adoModule = await import("../../services/ado/ado.service.js");
        const pushOrUpdateStoryToADO =
          adoModule.pushOrUpdateStoryToADO || adoModule.default?.pushOrUpdateStoryToADO;

        if (typeof pushOrUpdateStoryToADO !== "function") {
          throw new Error("pushOrUpdateStoryToADO is not exported from ado.service.js");
        }

        adoId = await pushOrUpdateStoryToADO(story, adoConfig);

        console.log("[approve] ADO work item synced:", adoId);

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

/** POST /api/stories/regenerate-ac/:id — regenerate acceptance criteria via Claude */
export const regenerateAC = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id || req.body.storyId)
      .populate("clientId", "name");

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    const { analyzeMessage } = await import("../../services/ai/ai.service.js");

    const messageText = story.sourceQuote
      || story.description
      || story.title;

    console.log("[regen-ac] Regenerating AC for:",
      story.storyTitle?.substring(0, 50));

    const result = await analyzeMessage({
      text: messageText,
      clientName: story.clientId?.name || "Client",
    });

    if (result.acceptanceCriteria?.length > 0) {
      story.acceptanceCriteria = result.acceptanceCriteria
        .map((ac) => (typeof ac === "string" ? ac : ac.scenario || ""))
        .filter(Boolean);

      story.acceptanceCriteriaFormatted = (result.acceptanceCriteriaFormatted?.length
        ? result.acceptanceCriteriaFormatted
        : result.acceptanceCriteria)
        .map((ac, i) => ({
          id: (typeof ac === "object" && ac.id) ? ac.id : `AC ${i + 1}`,
          scenario: typeof ac === "string" ? ac : ac.scenario || "",
        }))
        .filter((ac) => ac.scenario);

      if (result.description
        && result.description.includes("As a")
        && result.description.includes("So that")) {
        story.description = result.description;
        story.descriptionStatement = result.description;
      }

      if (result.businessRequirement) {
        story.businessRequirement = result.businessRequirement;
      }
      if (result.userFlow) {
        story.userFlow = result.userFlow;
      }
      if (result.uiBehavior) {
        story.uiBehavior = result.uiBehavior;
      }
      if (result.validations?.length > 0) {
        story.validations = result.validations;
      }
      if (result.releaseNotes) {
        story.releaseNotes = result.releaseNotes;
      }

      await story.save();

      console.log("[regen-ac] Updated AC count:",
        story.acceptanceCriteriaFormatted.length);

      return res.json({
        success: true,
        story,
        acCount: story.acceptanceCriteriaFormatted.length,
        message: `AC regenerated with ${story.acceptanceCriteriaFormatted.length} criteria`,
      });
    }

    res.json({
      success: false,
      message: "AI could not generate AC for this story",
    });
  } catch (error) {
    console.error("[regen-ac] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/stories/regenerate-ac/bulk — bulk regenerate AC for Slack stories */
export const bulkRegenerateAC = async (req, res) => {
  try {
    const { analyzeMessage } = await import("../../services/ai/ai.service.js");

    const stories = await Story.find({
      source: "slack",
      $or: [
        { acceptanceCriteria: { $size: 0 } },
        { acceptanceCriteriaFormatted: { $size: 0 } },
        { acceptanceCriteria: { $exists: false } },
        {
          acceptanceCriteriaFormatted: {
            $exists: true,
            $not: { $elemMatch: { scenario: /Given.*When.*Then/i } },
          },
        },
      ],
    }).populate("clientId", "name");

    console.log("[bulk-regen] Found", stories.length,
      "stories needing AC regeneration");

    const results = { success: [], failed: [], total: stories.length };

    for (const story of stories) {
      try {
        const messageText = story.sourceQuote
          || story.description
          || story.storyTitle
          || story.title;

        if (!messageText) {
          results.failed.push({
            id: story._id,
            title: story.storyTitle || story.title,
            reason: "No source text found",
          });
          continue;
        }

        console.log("[bulk-regen] Processing:",
          (story.storyTitle || story.title)?.substring(0, 50));

        const result = await analyzeMessage({
          text: messageText,
          clientName: story.clientId?.name || "Client",
        });

        if (result.acceptanceCriteria?.length > 0) {
          story.acceptanceCriteria = result.acceptanceCriteria
            .map((ac) => (typeof ac === "string" ? ac : ac.scenario || ""))
            .filter(Boolean);

          story.acceptanceCriteriaFormatted = (result.acceptanceCriteriaFormatted?.length
            ? result.acceptanceCriteriaFormatted
            : result.acceptanceCriteria)
            .map((ac, i) => ({
              id: (typeof ac === "object" && ac.id) ? ac.id : `AC ${i + 1}`,
              scenario: typeof ac === "string" ? ac : ac.scenario || "",
            }))
            .filter((ac) => ac.scenario);

          if (result.description?.includes("As a")
            && result.description?.includes("So that")) {
            story.description = result.description;
            story.descriptionStatement = result.description;
          }

          if (result.storyTitle
            && result.storyTitle !== story.sourceQuote) {
            story.storyTitle = result.storyTitle;
            story.title = result.storyTitle;
          }

          if (result.businessRequirement) {
            story.businessRequirement = result.businessRequirement;
          }
          if (result.userFlow) {
            story.userFlow = result.userFlow;
          }
          if (result.uiBehavior) {
            story.uiBehavior = result.uiBehavior;
          }
          if (result.validations?.length > 0) {
            story.validations = result.validations;
          }
          if (result.releaseNotes) {
            story.releaseNotes = result.releaseNotes;
          }

          await story.save();

          results.success.push({
            id: story._id,
            title: story.storyTitle || story.title,
            acCount: story.acceptanceCriteriaFormatted.length,
          });

          console.log("[bulk-regen] ✅ Updated:",
            (story.storyTitle || story.title)?.substring(0, 40),
            "| AC:", story.acceptanceCriteriaFormatted.length);
        } else {
          results.failed.push({
            id: story._id,
            title: story.storyTitle || story.title,
            reason: "AI returned empty AC",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (storyError) {
        console.error("[bulk-regen] Failed story:",
          story._id, storyError.message);
        results.failed.push({
          id: story._id,
          title: story.storyTitle || story.title,
          reason: storyError.message,
        });
      }
    }

    console.log("[bulk-regen] Done. Success:",
      results.success.length, "Failed:", results.failed.length);

    res.json({
      success: true,
      message: `Regenerated AC for ${results.success.length} stories`,
      updated: results.success.length,
      failed: results.failed.length,
      total: results.total,
      details: results,
    });
  } catch (error) {
    console.error("[bulk-regen] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** GET /api/stories/ado-users — list assignable users from ADO */
export const getADOUsers = async (req, res) => {
  try {
    const organisationId = getOrgId(req);
    const AdoConnection = (await import("../../models/AdoConnection.model.js")).default;

    const orgFilter = organisationId ? { organisationId } : {};

    const connection = await AdoConnection.findOne({
      ...orgFilter,
      isDefault: true,
      isActive: true,
      connectionStatus: "connected",
    }) || await AdoConnection.findOne({
      ...orgFilter,
      isActive: true,
      connectionStatus: "connected",
    });

    if (!connection) {
      console.log("[ado-users] No active ADO connection found");
      return res.json({ success: true, users: [] });
    }

    const org = connection.adoOrg;
    const project = connection.adoProject;
    const token = connection.patToken;
    const pat = Buffer.from(`:${token}`).toString("base64");

    console.log("[ado-users] Fetching users from:", org, project);

    const teamUrl = `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(project)}/teams?api-version=7.0`;

    const teamResponse = await fetch(teamUrl, {
      headers: {
        Authorization: `Basic ${pat}`,
        Accept: "application/json",
      },
    });

    console.log("[ado-users] Team response:", teamResponse.status);

    if (!teamResponse.ok) {
      const entitlementUrl = `https://vsaex.dev.azure.com/${org}/_apis/userentitlements?api-version=6.0-preview.3`;

      const entResponse = await fetch(entitlementUrl, {
        headers: {
          Authorization: `Basic ${pat}`,
          Accept: "application/json",
        },
      });

      console.log("[ado-users] Entitlement response:", entResponse.status);

      if (entResponse.ok) {
        const entText = await entResponse.text();
        if (entText.includes("<!DOCTYPE")) {
          return res.json({ success: true, users: [] });
        }
        const entData = JSON.parse(entText);
        const users = (entData.members || entData.value || [])
          .map((m) => ({
            id: m.id || m.user?.subjectDescriptor,
            displayName: m.user?.displayName || m.user?.principalName,
            email: m.user?.mailAddress || m.user?.principalName,
            uniqueName: m.user?.mailAddress || m.user?.principalName,
          }))
          .filter((u) => u.email && u.displayName);

        console.log("[ado-users] Found via entitlement:", users.length);
        return res.json({ success: true, users });
      }

      return res.json({ success: true, users: [] });
    }

    const teamText = await teamResponse.text();
    if (teamText.includes("<!DOCTYPE")) {
      return res.json({ success: true, users: [] });
    }

    const teamData = JSON.parse(teamText);
    console.log("[ado-users] Teams found:", teamData.value?.length);

    const allUsers = [];

    for (const team of teamData.value || []) {
      const membersUrl = `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(project)}/teams/${team.id}/members?api-version=7.0`;

      const membersResponse = await fetch(membersUrl, {
        headers: {
          Authorization: `Basic ${pat}`,
          Accept: "application/json",
        },
      });

      if (membersResponse.ok) {
        const membersText = await membersResponse.text();
        if (membersText.includes("<!DOCTYPE")) continue;

        const membersData = JSON.parse(membersText);

        for (const member of membersData.value || []) {
          const email = member.identity?.uniqueName
            || member.identity?.subjectDescriptor;
          const name = member.identity?.displayName;
          const id = member.identity?.id;

          if (email && !allUsers.find((u) => u.email === email)) {
            allUsers.push({
              id,
              displayName: name || email,
              email,
              uniqueName: email,
            });
          }
        }
      }
    }

    console.log("[ado-users] Total users:", allUsers.length);
    allUsers.forEach((u) =>
      console.log("[ado-users]", u.displayName, "-", u.email)
    );

    res.json({ success: true, users: allUsers });
  } catch (error) {
    console.error("[ado-users] Error:", error.message);
    res.json({ success: true, users: [] });
  }
};

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
