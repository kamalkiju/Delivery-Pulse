import { Buffer } from "node:buffer";

const buildADODescription = (story) => {
  let html = "";

  if (story.description) {
    html += `<div style="margin-bottom:16px">
      <strong>Description:</strong><br/>
      <em>${story.description}</em>
    </div>`;
  }

  if (story.businessRequirement) {
    html += `<div style="margin-bottom:16px">
      <strong>Business Requirement:</strong><br/>
      ${story.businessRequirement}
    </div>`;
  }

  if (story.userFlow) {
    html += `<div style="margin-bottom:16px">
      <strong>User Flow:</strong><br/>
      ${story.userFlow.replace(/\n/g, "<br/>")}
    </div>`;
  }

  if (story.uiBehavior) {
    html += `<div style="margin-bottom:16px">
      <strong>UI Behavior:</strong><br/>
      ${story.uiBehavior}
    </div>`;
  }

  if (story.validations?.length > 0) {
    html += `<div style="margin-bottom:16px">
      <strong>Validations:</strong><br/>
      <ul>
        ${story.validations.map((v) => `<li>${v}</li>`).join("")}
      </ul>
    </div>`;
  }

  if (story.figmaLink) {
    html += `<div style="margin-bottom:16px">
      <strong>Figma Design:</strong><br/>
      <a href="${story.figmaLink}">${story.figmaLink}</a>
    </div>`;
  }

  if (story.releaseNotes) {
    html += `<div style="margin-bottom:16px">
      <strong>Release Notes:</strong><br/>
      ${story.releaseNotes}
    </div>`;
  }

  return html;
};

export const createADOWorkItem = async (story) => {
  const org = process.env.ADO_ORG;
  const project = process.env.ADO_PROJECT;
  const token = process.env.ADO_TOKEN;

  if (!org || !project || !token) {
    throw new Error("ADO_ORG, ADO_PROJECT and ADO_TOKEN must be set");
  }

  console.log("[ado] Creating work item for:", story.storyTitle);
  console.log("[ado] Org:", org, "Project:", project);

  const pat = Buffer.from(`:${token}`).toString("base64");
  const workItemType = story.type === "Bug" ? "Bug" : "User Story";

  const acHtml = (story.acceptanceCriteriaFormatted ||
    story.acceptanceCriteria || [])
    .map((ac, i) => {
      const id = typeof ac === "object"
        ? (ac.id || `AC ${i + 1}`)
        : `AC ${i + 1}`;
      const scenario = typeof ac === "string"
        ? ac
        : (ac.scenario || ac.then || "");
      return `<div><strong>${id}:</strong> ${scenario}</div>`;
    })
    .join("<br/>");

  const priorityMap = {
    Critical: 1,
    High: 2,
    Medium: 3,
    Low: 4,
  };

  const patchDocument = [
    {
      op: "add",
      path: "/fields/System.Title",
      value: story.storyTitle || story.title,
    },
    {
      op: "add",
      path: "/fields/System.Description",
      value: buildADODescription(story),
    },
    {
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
      value: acHtml,
    },
    {
      op: "add",
      path: "/fields/Microsoft.VSTS.Common.Priority",
      value: priorityMap[story.priority] || 3,
    },
  ];

  if (story.sprint && story.sprint !== "Backlog") {
    patchDocument.push({
      op: "add",
      path: "/fields/System.IterationPath",
      value: `${project}\\${story.sprint}`,
    });
  }

  if (story.assignee) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.AssignedTo",
      value: story.assignee,
    });
  }

  if (story.tags?.length > 0) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.Tags",
      value: story.tags.join("; "),
    });
  }

  if (story.areaPath) {
    patchDocument.push({
      op: "add",
      path: "/fields/System.AreaPath",
      value: story.areaPath,
    });
  }

  const encodedProject = encodeURIComponent(project);
  const encodedType = encodeURIComponent(workItemType);
  const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$${encodedType}?api-version=7.0`;

  console.log("[ado] Calling URL:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Basic ${pat}`,
    },
    body: JSON.stringify(patchDocument),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error("[ado] Error:", response.status, responseText);
    throw new Error(`ADO error ${response.status}: ${responseText}`);
  }

  const result = JSON.parse(responseText);
  console.log("[ado] Work item created! ID:", result.id);
  return result.id;
};

/** @deprecated Use createADOWorkItem — kept for story.service compatibility */
export const createWorkItem = createADOWorkItem;

const adoBaseUrl = () =>
  `https://dev.azure.com/${process.env.ADO_ORG}/${encodeURIComponent(process.env.ADO_PROJECT ?? "")}`;

export async function updateWorkItemStatus(adoId, status) {
  const token = process.env.ADO_TOKEN;
  if (!process.env.ADO_ORG || !process.env.ADO_PROJECT || !token) {
    console.warn("[ado] ADO not configured — skipping status update");
    return;
  }

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
  const url = `${adoBaseUrl()}/_apis/wit/workitems/${adoId}?api-version=7.0`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Basic ${pat}`,
    },
    body: JSON.stringify([
      { op: "add", path: "/fields/System.State", value: adoState },
    ]),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[ado] Failed to update work item status:", body);
    throw new Error("Failed to update ADO work item status");
  }
}

export default { createADOWorkItem, createWorkItem, updateWorkItemStatus };
