import { Buffer } from "node:buffer";
import AdoConnection from "../../models/AdoConnection.model.js";

export async function resolveAdoConfig(config = null) {
  if (config?.org && config?.project && config?.token) {
    console.log("[ado] Using config passed directly");
    return {
      org: config.org,
      project: config.project,
      token: config.token,
    };
  }

  const conn = await AdoConnection.findOne({
    isActive: true,
    connectionStatus: "connected",
  }).sort({ isDefault: -1, createdAt: -1 });

  if (conn) {
    console.log("[ado] Using DB connection:", conn.name);
    return {
      org: conn.adoOrg,
      project: conn.adoProject,
      token: conn.patToken,
    };
  }

  return null;
}

const VALID_SPRINT_NAMES = ["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"];
const PRIORITY_MAP = { Critical: 1, High: 2, Medium: 3, Low: 4 };

/** Extract leaf story title from "Epic > Feature > Story" format */
export function extractStoryTitle(story) {
  const raw = story.storyTitle || story.title || "";
  const parts = raw.split(">").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return raw || "Untitled Story";
}

async function getAvailableWorkItemTypes(config) {
  const conn = await AdoConnection.findOne({
    isActive: true,
    connectionStatus: "connected",
  }).sort({ isDefault: -1, createdAt: -1 });

  if (conn?.workItemTypes?.length) {
    return conn.workItemTypes;
  }

  const org = config?.org || conn?.adoOrg || process.env.ADO_ORG;
  const project = config?.project || conn?.adoProject || process.env.ADO_PROJECT;
  const token = config?.token || conn?.patToken || process.env.ADO_TOKEN;

  if (!org || !project || !token) {
    return ["User Story", "Feature", "Epic", "Issue", "Task"];
  }

  try {
    const pat = Buffer.from(`:${token}`).toString("base64");
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitemtypes?api-version=7.0`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${pat}`, Accept: "application/json" },
    });
    if (response.ok) {
      const data = await response.json();
      const types = (data.value || []).map((t) => t.name);
      if (types.length) {
        console.log("[ado] Available work item types:", types.join(", "));
        return types;
      }
    }
  } catch (err) {
    console.warn("[ado] Could not fetch work item types:", err.message);
  }

  return ["User Story", "Feature", "Epic", "Issue", "Task"];
}

function resolveTypeCandidates(availableTypes, preferredOrder) {
  const available = new Set(availableTypes);
  const matched = preferredOrder.filter((t) => available.has(t));
  return matched.length ? matched : [preferredOrder[preferredOrder.length - 1]];
}

async function createWorkItemWithFallback({
  org,
  project,
  token,
  typeCandidates,
  title,
  description = "",
  priority,
  tags,
  parentAdoId,
  iterationPath,
}) {
  const pat = Buffer.from(`:${token}`).toString("base64");
  const encodedProject = encodeURIComponent(project);
  let lastError = null;

  for (const workItemType of typeCandidates) {
    const patchDocument = [
      { op: "add", path: "/fields/System.Title", value: title },
      { op: "add", path: "/fields/System.Description", value: description || "" },
      {
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: PRIORITY_MAP[priority] || 3,
      },
    ];

    if (tags) {
      patchDocument.push({ op: "add", path: "/fields/System.Tags", value: tags });
    }

    if (iterationPath) {
      patchDocument.push({
        op: "add",
        path: "/fields/System.IterationPath",
        value: iterationPath,
      });
    }

    if (parentAdoId) {
      patchDocument.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `https://dev.azure.com/${org}/_apis/wit/workItems/${parentAdoId}`,
        },
      });
    }

    const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.0`;

    console.log("[ado] Creating", workItemType + ":", title.substring(0, 60));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: `Basic ${pat}`,
        Accept: "application/json",
      },
      body: JSON.stringify(patchDocument),
    });

    const responseText = await response.text();

    if (responseText.includes("<!DOCTYPE")) {
      throw new Error("ADO auth failed");
    }

    if (response.ok) {
      const result = JSON.parse(responseText);
      return { id: String(result.id), workItemType };
    }

    if (
      responseText.includes("does not exist")
      || responseText.includes("not found")
      || responseText.includes("Cannot find work item type")
    ) {
      console.log(`[ado] Type "${workItemType}" unavailable, trying next...`);
      lastError = new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`);
      continue;
    }

    throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`);
  }

  throw lastError || new Error("Failed to create ADO work item");
}

/** Link an existing ADO work item to a parent (Feature/Epic) — replaces old parent if needed */
export async function linkWorkItemToParent(workItemId, parentAdoId, config) {
  return replaceWorkItemParent(workItemId, parentAdoId, config);
}

export async function replaceWorkItemParent(workItemId, newParentAdoId, config) {
  if (!workItemId || !newParentAdoId) return false;

  const org = config?.org || process.env.ADO_ORG;
  const project = config?.project || process.env.ADO_PROJECT;
  const token = config?.token || process.env.ADO_TOKEN;
  const pat = Buffer.from(`:${token}`).toString("base64");
  const encodedProject = encodeURIComponent(project);

  const getUrl = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.0`;
  const getResp = await fetch(getUrl, {
    headers: { Authorization: `Basic ${pat}`, Accept: "application/json" },
  });

  if (!getResp.ok) {
    console.error("[ado] Failed to fetch work item relations:", getResp.status);
    return false;
  }

  const wi = await getResp.json();
  const relations = wi.relations || [];
  const parentRels = relations.filter((r) => r.rel === "System.LinkTypes.Hierarchy-Reverse");

  const alreadyLinked = parentRels.some(
    (r) => r.url?.includes(`/workItems/${newParentAdoId}`) || r.url?.endsWith(`/${newParentAdoId}`),
  );
  if (alreadyLinked) {
    console.log("[ado] Work item", workItemId, "already under parent", newParentAdoId);
    return true;
  }

  const patchOps = [];
  const removeIndices = parentRels
    .map((rel) => relations.indexOf(rel))
    .filter((idx) => idx !== -1)
    .sort((a, b) => b - a);

  for (const idx of removeIndices) {
    patchOps.push({ op: "remove", path: `/relations/${idx}` });
  }

  patchOps.push({
    op: "add",
    path: "/relations/-",
    value: {
      rel: "System.LinkTypes.Hierarchy-Reverse",
      url: `https://dev.azure.com/${org}/_apis/wit/workItems/${newParentAdoId}`,
    },
  });

  const patchUrl = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/${workItemId}?api-version=7.0`;
  const response = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Basic ${pat}`,
      Accept: "application/json",
    },
    body: JSON.stringify(patchOps),
  });

  const text = await response.text();
  if (response.ok) {
    console.log("[ado] Re-linked work item", workItemId, "→ parent", newParentAdoId);
    return true;
  }

  if (text.includes("already") || text.includes("TF201330") || text.includes("duplicate")) {
    return true;
  }

  console.error("[ado] Replace parent failed:", response.status, text.substring(0, 200));
  return false;
}

async function ensureStoryHierarchy(story, credentials) {
  let epicAdoId = null;
  let featureAdoId = null;

  if (story.featureId) {
    try {
      if (story.epicId) {
        epicAdoId = await ensureEpicInADO(story.epicId, credentials);
      }
      featureAdoId = await ensureFeatureInADO(story.featureId, epicAdoId, credentials);
    } catch (err) {
      console.error("[ado] Hierarchy ensure error:", err.message);
    }
  }

  return { epicAdoId, featureAdoId };
}

function buildStoryDescriptionHtml(story) {
  const nl = (text) => (text || "").replace(/\n/g, "<br/>");
  let descriptionHtml = `<div><em>${story.description || ""}</em></div>`;

  if (story.businessRequirement) {
    descriptionHtml += `<br/><div><strong>Business Requirement:</strong><br/>${story.businessRequirement}</div>`;
  }
  if (story.userFlow) {
    descriptionHtml += `<br/><div><strong>User Flow:</strong><br/>${nl(story.userFlow)}</div>`;
  }
  if (story.uiBehavior) {
    descriptionHtml += `<br/><div><strong>UI Behavior:</strong><br/>${story.uiBehavior}</div>`;
  }
  if (story.validations?.length > 0) {
    descriptionHtml += `<br/><div><strong>Validations:</strong><br/><ul>${
      story.validations.map((v) => `<li>${v}</li>`).join("")
    }</ul></div>`;
  }
  if (story.figmaLink) {
    descriptionHtml += `<br/><div><strong>Figma:</strong> <a href="${story.figmaLink}">${story.figmaLink}</a></div>`;
  }
  if (story.releaseNotes) {
    descriptionHtml += `<br/><div><strong>Release Notes:</strong><br/>${story.releaseNotes}</div>`;
  }

  const acList = story.acceptanceCriteriaFormatted || story.acceptanceCriteria || [];
  if (acList.length > 0) {
    descriptionHtml += "<br/><div><strong>Acceptance Criteria:</strong>";
    acList.forEach((ac, i) => {
      const id = typeof ac === "object" ? (ac.id || `AC ${i + 1}`) : `AC ${i + 1}`;
      const scenario = typeof ac === "string" ? ac : (ac.scenario || "");
      descriptionHtml += `<div style="margin:4px 0;padding:8px;background:#f8f8f8;border-left:3px solid #0078d4"><strong>${id}:</strong> ${scenario}</div>`;
    });
    descriptionHtml += "</div>";
  }

  return descriptionHtml;
}

function buildStoryFieldPatches(story, project) {
  const storyTitle = extractStoryTitle(story);
  const priorityMap = { Critical: 1, High: 2, Medium: 3, Low: 4 };

  const patches = [
    { op: "replace", path: "/fields/System.Title", value: storyTitle },
    { op: "replace", path: "/fields/System.Description", value: buildStoryDescriptionHtml(story) },
    {
      op: "replace",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: priorityMap[story.priority] || 3,
    },
  ];

  if (story.tags?.length > 0) {
    patches.push({ op: "replace", path: "/fields/System.Tags", value: story.tags.join("; ") });
  }

  if (story.assignee) {
    patches.push({ op: "replace", path: "/fields/System.AssignedTo", value: story.assignee });
  }

  if (story.sprint && VALID_SPRINT_NAMES.includes(story.sprint)) {
    patches.push({
      op: "replace",
      path: "/fields/System.IterationPath",
      value: `${project}\\${story.sprint}`,
    });
  }

  return patches;
}

/** Update an existing ADO work item with latest story fields */
export async function updateExistingADOWorkItem(story, config) {
  const org = config?.org || process.env.ADO_ORG;
  const project = config?.project || process.env.ADO_PROJECT;
  const token = config?.token || process.env.ADO_TOKEN;
  const pat = Buffer.from(`:${token}`).toString("base64");
  const encodedProject = encodeURIComponent(project);

  let patchDocument = buildStoryFieldPatches(story, project);

  const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/${story.adoId}?api-version=7.0`;

  let response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Basic ${pat}`,
      Accept: "application/json",
    },
    body: JSON.stringify(patchDocument),
  });

  let text = await response.text();

  if (!response.ok && text.includes("does not exist")) {
    patchDocument = patchDocument.map((p) => ({ ...p, op: "add" }));
    response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: `Basic ${pat}`,
        Accept: "application/json",
      },
      body: JSON.stringify(patchDocument),
    });
    text = await response.text();
  }

  if (!response.ok) {
    throw new Error(`ADO update ${response.status}: ${text.substring(0, 200)}`);
  }

  console.log("[ado] Updated work item", story.adoId, "→", extractStoryTitle(story));
  return story.adoId;
}

/** Create new or update existing ADO work item with correct hierarchy */
export async function pushOrUpdateStoryToADO(story, config = null) {
  const credentials = await resolveAdoConfig(config);
  if (!credentials) {
    throw new Error("ADO credentials not configured.");
  }

  const { featureAdoId } = await ensureStoryHierarchy(story, credentials);

  if (story.adoId && !String(story.adoId).includes("MOCK")) {
    await updateExistingADOWorkItem(story, credentials);
    if (featureAdoId) {
      await replaceWorkItemParent(story.adoId, featureAdoId, credentials);
    }
    return story.adoId;
  }

  return createADOWorkItem(story, credentials);
}

export const ensureEpicInADO = async (epicId, config) => {
  try {
    const Epic = (await import("../../models/Epic.model.js")).default;
    const epic = await Epic.findById(epicId);

    if (!epic) return null;

    if (epic.adoId) {
      console.log("[ado] Epic already in ADO:", epic.name, "#" + epic.adoId);
      return epic.adoId;
    }

    const org = config?.org || process.env.ADO_ORG;
    const project = config?.project || process.env.ADO_PROJECT;
    const token = config?.token || process.env.ADO_TOKEN;
    const encodedProject = encodeURIComponent(project);
    const availableTypes = await getAvailableWorkItemTypes(config);

    let result;
    if (availableTypes.includes("Epic")) {
      try {
        result = await createWorkItemWithFallback({
          org,
          project,
          token,
          typeCandidates: ["Epic"],
          title: epic.name,
          description: epic.description,
          priority: epic.priority,
          parentAdoId: null,
        });
      } catch (err) {
        console.log("[ado] Epic type failed, falling back to Issue:", err.message);
      }
    }

    if (!result) {
      result = await createWorkItemWithFallback({
        org,
        project,
        token,
        typeCandidates: ["Issue"],
        title: `[Epic] ${epic.name}`,
        description: epic.description,
        priority: epic.priority,
        tags: "Epic",
        parentAdoId: null,
      });
    }

    epic.adoId = result.id;
    epic.adoUrl = `https://dev.azure.com/${org}/${encodedProject}/_workitems/edit/${result.id}`;
    await epic.save();

    console.log("[ado] ✅ Epic pushed as", result.workItemType + ":", epic.name, "#" + result.id);
    return result.id;
  } catch (error) {
    console.error("[ado] Epic push failed:", error.message);
    return null;
  }
};

export const ensureFeatureInADO = async (featureId, epicAdoId, config) => {
  try {
    const Feature = (await import("../../models/Feature.model.js")).default;
    const feature = await Feature.findById(featureId);

    if (!feature) return null;

    if (feature.adoId) {
      console.log("[ado] Feature already in ADO:", feature.name, "#" + feature.adoId);
      return feature.adoId;
    }

    const org = config?.org || process.env.ADO_ORG;
    const project = config?.project || process.env.ADO_PROJECT;
    const token = config?.token || process.env.ADO_TOKEN;
    const encodedProject = encodeURIComponent(project);
    const conn = await AdoConnection.findOne({
      isActive: true,
      connectionStatus: "connected",
    }).sort({ isDefault: -1, createdAt: -1 });

    const availableTypes = await getAvailableWorkItemTypes(config);

    const iterationPath = feature.sprint && VALID_SPRINT_NAMES.includes(feature.sprint)
      ? `${conn?.adoProject || project}\\${feature.sprint}`
      : undefined;

    let result;
    if (availableTypes.includes("Feature")) {
      try {
        result = await createWorkItemWithFallback({
          org,
          project,
          token,
          typeCandidates: ["Feature"],
          title: feature.name,
          description: feature.description,
          priority: feature.priority,
          parentAdoId: epicAdoId,
          iterationPath,
        });
      } catch (err) {
        console.log("[ado] Feature type failed, falling back to Issue:", err.message);
      }
    }

    if (!result) {
      result = await createWorkItemWithFallback({
        org,
        project,
        token,
        typeCandidates: ["Issue"],
        title: `[Feature] ${feature.name}`,
        description: feature.description,
        priority: feature.priority,
        tags: "Feature",
        parentAdoId: epicAdoId,
        iterationPath,
      });
    }

    feature.adoId = result.id;
    feature.adoUrl = `https://dev.azure.com/${org}/${encodedProject}/_workitems/edit/${result.id}`;
    await feature.save();

    console.log("[ado] ✅ Feature pushed as", result.workItemType + ":", feature.name, "#" + result.id);
    return result.id;
  } catch (error) {
    console.error("[ado] Feature push failed:", error.message);
    return null;
  }
};

export const createADOWorkItem = async (story, config = null) => {
  const credentials = await resolveAdoConfig(config);

  if (!credentials) {
    throw new Error(
      "ADO credentials not configured. Add a connection in Settings → ADO Integration.",
    );
  }

  const { org, project, token } = credentials;

  console.log("[ado] org:", org);
  console.log("[ado] project:", project);
  console.log("[ado] token preview:", token.substring(0, 8) + "...");

  const pat = Buffer.from(`:${token}`).toString("base64");
  const availableTypes = await getAvailableWorkItemTypes(credentials);
  const typeCandidates = resolveTypeCandidates(availableTypes, ["User Story", "Issue"]);
  const storyTitle = extractStoryTitle(story);

  console.log("[ado] Story title for ADO:", storyTitle);
  console.log("[ado] Work item type candidates:", typeCandidates.join(", "));

  const priorityMap = { Critical: 1, High: 2, Medium: 3, Low: 4 };

  const patchDocument = [
    { op: "add", path: "/fields/System.Title", value: storyTitle },
    { op: "add", path: "/fields/System.Description", value: buildStoryDescriptionHtml(story) },
    {
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: priorityMap[story.priority] || 3,
    },
  ];

  if (story.tags?.length > 0) {
    patchDocument.push({ op: "add", path: "/fields/System.Tags", value: story.tags.join("; ") });
  }

  if (story.assignee) {
    patchDocument.push({ op: "add", path: "/fields/System.AssignedTo", value: story.assignee });
    console.log("[ado] Assigning to:", story.assignee);
  }

  if (story.sprint && VALID_SPRINT_NAMES.includes(story.sprint)) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.IterationPath",
      value: `${project}\\${story.sprint}`,
    });
  }

  const { featureAdoId } = await ensureStoryHierarchy(story, credentials);

  if (featureAdoId) {
    patchDocument.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        url: `https://dev.azure.com/${org}/_apis/wit/workItems/${featureAdoId}`,
      },
    });
    console.log("[ado] Story will be linked to Feature #" + featureAdoId);
  }

  const encodedProject = encodeURIComponent(project);
  let lastError = null;

  for (const workItemType of typeCandidates) {
    const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.0`;

    console.log("[ado] POST:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: `Basic ${pat}`,
        Accept: "application/json",
      },
      body: JSON.stringify(patchDocument),
    });

    console.log("[ado] Response status:", response.status);
    const responseText = await response.text();
    console.log("[ado] Response preview:", responseText.substring(0, 100));

    if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
      throw new Error(
        "ADO returned HTML. PAT token invalid or expired. "
        + "Update token in Settings → ADO Integration.",
      );
    }

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log("[ado] Work item created as", workItemType + ":", result.id);
      return result.id;
    }

    if (
      responseText.includes("does not exist")
      || responseText.includes("not found")
      || responseText.includes("Cannot find work item type")
    ) {
      console.log(`[ado] Type "${workItemType}" unavailable for story, trying next...`);
      lastError = new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`);
      continue;
    }

    throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`);
  }

  throw lastError || new Error("Failed to create story work item in ADO");
};

/** @deprecated Use createADOWorkItem — kept for story.service compatibility */
export const createWorkItem = createADOWorkItem;

export async function updateWorkItemStatus(adoId, status) {
  const credentials = await resolveAdoConfig();
  if (!credentials) {
    console.warn("[ado] ADO not configured — skipping status update");
    return;
  }

  const { org, project, token } = credentials;

  const stateMap = {
    "in-progress": "Active",
    "in progress": "Active",
    done: "Closed",
    completed: "Closed",
    resolved: "Closed",
    blocked: "On Hold",
    "on hold": "On Hold",
  };

  const adoState = stateMap[(status ?? "").trim().toLowerCase()];
  if (!adoState) {
    console.warn(`[ado] Unknown status "${status}" — no ADO update`);
    return;
  }

  const pat = Buffer.from(`:${token}`).toString("base64");
  const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitems/${adoId}?api-version=7.0`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Basic ${pat}`,
      Accept: "application/json",
    },
    body: JSON.stringify([
      { op: "add", path: "/fields/System.State", value: adoState },
    ]),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[ado] Failed to update work item status:", body.substring(0, 200));
    throw new Error("Failed to update ADO work item status");
  }
}

export default {
  resolveAdoConfig,
  extractStoryTitle,
  ensureEpicInADO,
  ensureFeatureInADO,
  linkWorkItemToParent,
  replaceWorkItemParent,
  updateExistingADOWorkItem,
  pushOrUpdateStoryToADO,
  createADOWorkItem,
  createWorkItem,
  updateWorkItemStatus,
};
