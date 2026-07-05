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
    const pat = Buffer.from(`:${token}`).toString("base64");
    const encodedProject = encodeURIComponent(project);

    const patchDocument = [
      {
        op: "add",
        path: "/fields/System.Title",
        value: epic.name,
      },
      {
        op: "add",
        path: "/fields/System.Description",
        value: epic.description || "",
      },
      {
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: { Critical: 1, High: 2, Medium: 3, Low: 4 }[epic.priority] || 3,
      },
    ];

    const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$Epic?api-version=7.0`;

    console.log("[ado] Pushing Epic to ADO:", epic.name);

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
      throw new Error("ADO auth failed for Epic push");
    }

    if (!response.ok) {
      const errText = responseText;
      if (errText.includes("does not exist")) {
        console.log("[ado] Epic type not found - retrying as Issue");
        const fallbackUrl = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$Issue?api-version=7.0`;

        patchDocument[0].value = `[Epic] ${epic.name}`;
        patchDocument.push({
          op: "add",
          path: "/fields/System.Tags",
          value: "Epic",
        });

        const fallbackResponse = await fetch(fallbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json-patch+json",
            Authorization: `Basic ${pat}`,
            Accept: "application/json",
          },
          body: JSON.stringify(patchDocument),
        });

        const fallbackText = await fallbackResponse.text();
        if (fallbackResponse.ok) {
          const fallbackResult = JSON.parse(fallbackText);
          epic.adoId = String(fallbackResult.id);
          epic.adoUrl = `https://dev.azure.com/${org}/${encodedProject}/_workitems/edit/${fallbackResult.id}`;
          await epic.save();
          console.log("[ado] ✅ Epic pushed as Issue:", epic.name, "#" + fallbackResult.id);
          return String(fallbackResult.id);
        }
      }
      throw new Error(`ADO Epic error ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const result = JSON.parse(responseText);
    const adoUrl = `https://dev.azure.com/${org}/${encodedProject}/_workitems/edit/${result.id}`;

    epic.adoId = String(result.id);
    epic.adoUrl = adoUrl;
    await epic.save();

    console.log("[ado] ✅ Epic pushed to ADO:", epic.name, "#" + result.id);
    return String(result.id);
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
    const pat = Buffer.from(`:${token}`).toString("base64");
    const encodedProject = encodeURIComponent(project);

    const patchDocument = [
      {
        op: "add",
        path: "/fields/System.Title",
        value: `[Feature] ${feature.name}`,
      },
      {
        op: "add",
        path: "/fields/System.Description",
        value: feature.description || "",
      },
      {
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: { Critical: 1, High: 2, Medium: 3, Low: 4 }[feature.priority] || 3,
      },
      {
        op: "add",
        path: "/fields/System.Tags",
        value: "Feature",
      },
    ];

    if (feature.sprint && feature.sprint !== "Backlog") {
      patchDocument.push({
        op: "add",
        path: "/fields/System.IterationPath",
        value: `${project}\\${feature.sprint}`,
      });
    }

    if (epicAdoId) {
      patchDocument.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: `https://dev.azure.com/${org}/_apis/wit/workItems/${epicAdoId}`,
        },
      });
    }

    const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$Issue?api-version=7.0`;

    console.log("[ado] Pushing Feature to ADO:", feature.name);

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
      throw new Error("ADO auth failed for Feature push");
    }

    if (!response.ok) {
      throw new Error(`ADO Feature error ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const result = JSON.parse(responseText);
    const adoUrl = `https://dev.azure.com/${org}/${encodedProject}/_workitems/edit/${result.id}`;

    feature.adoId = String(result.id);
    feature.adoUrl = adoUrl;
    await feature.save();

    console.log("[ado] ✅ Feature pushed to ADO:", feature.name, "#" + result.id);
    return String(result.id);
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
  const workItemType = "Issue";

  console.log("[ado] workItemType:", workItemType);

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

  const priorityMap = { Critical: 1, High: 2, Medium: 3, Low: 4 };

  const patchDocument = [
    {
      op: "add",
      path: "/fields/System.Title",
      value: story.storyTitle || story.title || "Untitled Story",
    },
    {
      op: "add",
      path: "/fields/System.Description",
      value: descriptionHtml,
    },
    {
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: priorityMap[story.priority] || 3,
    },
  ];

  if (story.tags?.length > 0) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.Tags",
      value: story.tags.join("; "),
    });
  }

  if (story.assignee) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.AssignedTo",
      value: story.assignee,
    });
    console.log("[ado] Assigning to:", story.assignee);
  }

  let featureAdoId = null;

  if (story.featureId) {
    try {
      let epicAdoId = null;

      if (story.epicId) {
        epicAdoId = await ensureEpicInADO(story.epicId, credentials);
        console.log("[ado] Epic ADO ID:", epicAdoId);
      }

      featureAdoId = await ensureFeatureInADO(
        story.featureId,
        epicAdoId,
        credentials,
      );
      console.log("[ado] Feature ADO ID:", featureAdoId);
    } catch (err) {
      console.error("[ado] Epic/Feature push error:", err.message);
    }
  }

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
  const encodedType = encodeURIComponent(workItemType);
  const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$${encodedType}?api-version=7.0`;

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

  if (!response.ok) {
    throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`);
  }

  const result = JSON.parse(responseText);
  console.log("[ado] Work item created:", result.id);
  return result.id;
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
  ensureEpicInADO,
  ensureFeatureInADO,
  createADOWorkItem,
  createWorkItem,
  updateWorkItemStatus,
};
