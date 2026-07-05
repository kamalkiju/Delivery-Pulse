import { Buffer } from "node:buffer";
import Story from "../../models/Story.model.js";
import { resolveAdoConfig } from "../../services/ado/ado.service.js";

const getADOClient = async () => {
  const credentials = await resolveAdoConfig();
  if (!credentials) {
    throw new Error(
      "ADO credentials not configured. Add a connection in Settings → ADO Integration.",
    );
  }

  const pat = Buffer.from(`:${credentials.token}`).toString("base64");
  return { ...credentials, pat };
};

const ADO_STATUS_MAP = {
  "To Do": "pushed-to-ado",
  Doing: "in-progress",
  Done: "done",
  Active: "in-progress",
  Resolved: "resolved",
  Closed: "done",
  New: "pushed-to-ado",
  Open: "pushed-to-ado",
  "In Progress": "in-progress",
  Completed: "done",
};

export const syncADOStories = async (req, res) => {
  try {
    const { org, project, pat } = await getADOClient();

    console.log("[ado-sync] Syncing from ADO...");

    const encodedProject = encodeURIComponent(project);

    const wiqlUrl = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/wiql?api-version=7.0`;

    const wiqlBody = {
      query: `SELECT [System.Id], [System.Title], [System.State], 
              [System.AssignedTo], [System.WorkItemType],
              [Microsoft.VSTS.Common.Priority],
              [System.IterationPath], [System.Tags],
              [System.ChangedDate]
              FROM WorkItems 
              WHERE [System.TeamProject] = '${project.replace(/'/g, "''")}'
              ORDER BY [System.ChangedDate] DESC`,
    };

    const wiqlResponse = await fetch(wiqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wiqlBody),
    });

    const responseText = await wiqlResponse.text();
    console.log("[ado-sync] Status:", wiqlResponse.status);

    if (responseText.includes("<!DOCTYPE")
      || responseText.includes("<html")) {
      throw new Error(
        "ADO authentication failed. PAT token expired. "
        + "Please update PAT token in Settings → ADO Integration.",
      );
    }

    if (!wiqlResponse.ok) {
      console.error("[ado-sync] WIQL error:", responseText.substring(0, 200));
      throw new Error(`Failed to query ADO: ${wiqlResponse.status}`);
    }

    const wiqlData = JSON.parse(responseText);
    const workItemIds = (wiqlData.workItems || [])
      .map((wi) => wi.id)
      .slice(0, 100);

    console.log("[ado-sync] Found", workItemIds.length, "work items in ADO");

    if (workItemIds.length === 0) {
      return res.json({
        success: true,
        synced: 0,
        workItems: [],
        message: "No work items found in ADO",
      });
    }

    const idsParam = workItemIds.join(",");
    const detailsUrl = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems?ids=${idsParam}&fields=System.Id,System.Title,System.State,System.AssignedTo,System.WorkItemType,Microsoft.VSTS.Common.Priority,System.IterationPath,System.Tags,System.Description,Microsoft.VSTS.Common.AcceptanceCriteria,System.ChangedDate,System.CreatedDate&api-version=7.0`;

    const detailsResponse = await fetch(detailsUrl, {
      headers: { Authorization: `Basic ${pat}` },
    });

    if (!detailsResponse.ok) {
      throw new Error("Failed to get work item details");
    }

    const detailsData = await detailsResponse.json();
    const workItems = detailsData.value || [];

    console.log("[ado-sync] Got details for", workItems.length, "items");

    let syncedCount = 0;
    for (const wi of workItems) {
      const adoId = String(wi.id);
      const adoState = wi.fields["System.State"];

      const story = await Story.findOne({ adoId });

      if (story && story.adoStatus !== adoState) {
        story.adoStatus = adoState;
        story.status = ADO_STATUS_MAP[adoState] || story.status;
        story.lastSyncedAt = new Date();
        await story.save();
        syncedCount++;
        console.log("[ado-sync] Updated story:", story.storyTitle, "→", adoState);
      }
    }

    console.log("[ado-sync] Synced", syncedCount, "stories");

    res.json({
      success: true,
      synced: syncedCount,
      total: workItems.length,
      workItems: workItems.map((wi) => ({
        adoId: wi.id,
        title: wi.fields["System.Title"],
        state: wi.fields["System.State"],
        type: wi.fields["System.WorkItemType"],
        priority: wi.fields["Microsoft.VSTS.Common.Priority"],
        assignedTo: wi.fields["System.AssignedTo"]?.displayName,
        assignedToEmail: wi.fields["System.AssignedTo"]?.uniqueName,
        iteration: wi.fields["System.IterationPath"],
        tags: wi.fields["System.Tags"],
        changedDate: wi.fields["System.ChangedDate"],
        createdDate: wi.fields["System.CreatedDate"],
        adoUrl: `https://dev.azure.com/${org}/${encodedProject}/_workitems/edit/${wi.id}`,
      })),
    });
  } catch (error) {
    console.error("[ado-sync] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getADOBoard = async (req, res) => {
  try {
    const stories = await Story.find({
      status: { $in: ["pushed-to-ado", "in-progress", "resolved", "done", "approved"] },
      adoId: { $exists: true, $ne: null },
    })
      .populate("clientId", "name company")
      .sort({ updatedAt: -1 });

    console.log("[ado-board] Found", stories.length, "ADO stories");

    res.json({ success: true, stories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStoryFromADO = async (req, res) => {
  try {
    const { adoId, state } = req.body;

    if (!adoId || !state) {
      return res.status(400).json({ success: false, message: "adoId and state are required" });
    }

    const story = await Story.findOne({ adoId: String(adoId) });

    if (!story) {
      return res.status(404).json({ success: false, message: "Story not found" });
    }

    story.adoStatus = state;
    story.status = ADO_STATUS_MAP[state] || story.status;
    story.lastSyncedAt = new Date();
    await story.save();

    res.json({ success: true, story });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkPushToADO = async (req, res) => {
  try {
    const { createADOWorkItem, resolveAdoConfig } = await import(
      "../../services/ado/ado.service.js"
    );

    const adoCredentials = await resolveAdoConfig();
    if (!adoCredentials) {
      return res.status(400).json({
        success: false,
        message: "No ADO connection configured. Add one in Settings → ADO Integration.",
      });
    }

    console.log("[bulk-push] Finding stories not in ADO...");

    const stories = await Story.find({
      status: { $in: ["approved", "pushed-to-ado"] },
      $or: [
        { adoId: null },
        { adoId: { $exists: false } },
        { adoId: "" },
      ],
    }).populate("clientId", "name");

    console.log("[bulk-push] Found", stories.length, "stories to push");

    const results = {
      success: [],
      failed: [],
      total: stories.length,
    };

    for (const story of stories) {
      try {
        const storyTitle = story.storyTitle || story.title || "Untitled Story";
        console.log("[bulk-push] Pushing:", storyTitle);

        const adoId = await createADOWorkItem(story, adoCredentials);

        const adoUrl = `https://dev.azure.com/${adoCredentials.org}/${encodeURIComponent(adoCredentials.project)}/_workitems/edit/${adoId}`;

        story.adoId = String(adoId);
        story.adoUrl = adoUrl;
        story.status = "pushed-to-ado";
        await story.save();

        results.success.push({
          storyId: story._id,
          storyTitle,
          adoId,
          adoUrl,
        });

        console.log("[bulk-push] ✅ Pushed:", storyTitle.substring(0, 40), "→ ADO #" + adoId);

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        const storyTitle = story.storyTitle || story.title || "Untitled Story";
        console.error("[bulk-push] ❌ Failed:", storyTitle.substring(0, 40), error.message);
        results.failed.push({
          storyId: story._id,
          storyTitle,
          error: error.message,
        });
      }
    }

    console.log("[bulk-push] Done. Success:", results.success.length, "Failed:", results.failed.length);

    res.json({
      success: true,
      message: `Pushed ${results.success.length} stories to ADO. Failed: ${results.failed.length}`,
      pushed: results.success.length,
      failed: results.failed.length,
      total: results.total,
      details: results,
    });
  } catch (error) {
    console.error("[bulk-push] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const syncHierarchyToADO = async (req, res) => {
  try {
    const Epic = (await import("../../models/Epic.model.js")).default;
    const Feature = (await import("../../models/Feature.model.js")).default;
    const AdoConnection = (await import(
      "../../models/AdoConnection.model.js"
    )).default;
    const {
      ensureEpicInADO,
      ensureFeatureInADO,
      linkWorkItemToParent,
    } = await import("../../services/ado/ado.service.js");

    const conn = await AdoConnection.findOne({
      isDefault: true,
      isActive: true,
      connectionStatus: "connected",
    }) || await AdoConnection.findOne({
      isActive: true,
      connectionStatus: "connected",
    });

    if (!conn) {
      return res.status(400).json({
        success: false,
        message: "No active ADO connection",
      });
    }

    const config = {
      org: conn.adoOrg,
      project: conn.adoProject,
      token: conn.patToken,
    };

    const results = {
      epics: { pushed: 0, skipped: 0, failed: 0 },
      features: { pushed: 0, skipped: 0, failed: 0 },
      stories: { linked: 0, skipped: 0, failed: 0 },
    };

    const missingAdoFilter = {
      $or: [{ adoId: null }, { adoId: "" }, { adoId: { $exists: false } }],
    };

    const epicsWithoutADO = await Epic.find(missingAdoFilter);
    console.log("[sync-hierarchy] Epics to push:", epicsWithoutADO.length);

    for (const epic of epicsWithoutADO) {
      try {
        const adoId = await ensureEpicInADO(epic._id, config);
        if (adoId) {
          results.epics.pushed++;
          console.log("[sync-hierarchy] ✅ Epic pushed:", epic.name, "#" + adoId);
        } else {
          results.epics.failed++;
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        results.epics.failed++;
        console.error("[sync-hierarchy] ❌ Epic failed:", epic.name, err.message);
      }
    }

    const featuresWithoutADO = await Feature.find(missingAdoFilter)
      .populate("epicId");
    console.log("[sync-hierarchy] Features to push:", featuresWithoutADO.length);

    for (const feature of featuresWithoutADO) {
      try {
        let epicAdoId = feature.epicId?.adoId || null;
        if (!epicAdoId && feature.epicId?._id) {
          epicAdoId = await ensureEpicInADO(feature.epicId._id, config);
        }

        const adoId = await ensureFeatureInADO(feature._id, epicAdoId, config);
        if (adoId) {
          results.features.pushed++;
          console.log("[sync-hierarchy] ✅ Feature pushed:",
            feature.name, "#" + adoId,
            epicAdoId ? `→ Epic #${epicAdoId}` : "");
        } else {
          results.features.failed++;
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        results.features.failed++;
        console.error("[sync-hierarchy] ❌ Feature failed:", feature.name, err.message);
      }
    }

    const storiesWithADO = await Story.find({
      adoId: { $exists: true, $nin: [null, ""] },
      featureId: { $exists: true, $ne: null },
    })
      .populate("featureId")
      .populate("epicId");

    console.log("[sync-hierarchy] Stories to link:", storiesWithADO.length);

    for (const story of storiesWithADO) {
      try {
        if (!story.adoId || story.adoId.includes("MOCK")) {
          results.stories.skipped++;
          continue;
        }

        let featureAdoId = story.featureId?.adoId || null;

        if (!featureAdoId && story.featureId?._id) {
          let epicAdoId = story.epicId?.adoId || null;
          if (!epicAdoId && story.epicId?._id) {
            epicAdoId = await ensureEpicInADO(story.epicId._id, config);
          }
          featureAdoId = await ensureFeatureInADO(
            story.featureId._id,
            epicAdoId,
            config,
          );
        }

        if (!featureAdoId) {
          results.stories.skipped++;
          continue;
        }

        const linked = await linkWorkItemToParent(
          story.adoId,
          featureAdoId,
          config,
        );

        if (linked) {
          results.stories.linked++;
          console.log("[sync-hierarchy] ✅ Story linked:",
            story.storyTitle?.substring(0, 40),
            `ADO #${story.adoId} → Feature #${featureAdoId}`);
        } else {
          results.stories.failed++;
        }

        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        results.stories.failed++;
        console.error("[sync-hierarchy] ❌ Story link failed:",
          story.storyTitle?.substring(0, 30), err.message);
      }
    }

    console.log("[sync-hierarchy] Done:", JSON.stringify(results));

    res.json({
      success: true,
      results,
      message: `Synced: ${results.epics.pushed} epics, ${results.features.pushed} features pushed, ${results.stories.linked} stories linked`,
    });
  } catch (error) {
    console.error("[sync-hierarchy] Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
