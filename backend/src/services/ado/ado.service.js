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

export default { resolveAdoConfig, createADOWorkItem, createWorkItem, updateWorkItemStatus };
