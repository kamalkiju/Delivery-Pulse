import { Buffer } from "node:buffer";

export const createADOWorkItem = async (story) => {
  const org = process.env.ADO_ORG;
  const project = process.env.ADO_PROJECT;
  const token = process.env.ADO_TOKEN;

  if (!org || !project || !token) {
    throw new Error(
      `ADO credentials missing: org=${org} project=${project} token=${token ? "set" : "NOT SET"}`,
    );
  }

  console.log("[ado] org:", org);
  console.log("[ado] project:", project);
  console.log("[ado] token preview:", token.substring(0, 8) + "...");

  const pat = Buffer.from(`:${token}`).toString("base64");
  const workItemType = "Issue";

  const nl = (text) => (text || "").replace(/\n/g, "<br/>");

  let descriptionHtml = "";

  if (story.description) {
    descriptionHtml += `<div><strong>Description:</strong><br/><em>${story.description}</em></div>`;
  }

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

  const acHtml = (story.acceptanceCriteriaFormatted ||
    story.acceptanceCriteria || [])
    .map((ac, i) => {
      const id = typeof ac === "object" ? (ac.id || `AC ${i + 1}`) : `AC ${i + 1}`;
      const scenario = typeof ac === "string" ? ac : (ac.scenario || "");
      return `<div><strong>${id}:</strong> ${scenario}</div>`;
    })
    .join("<br/>");

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
      path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
      value: acHtml || "No acceptance criteria defined",
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

  const encodedProject = encodeURIComponent(project);
  const encodedType = encodeURIComponent(workItemType);
  const url = `https://dev.azure.com/${org}/${encodedProject}/_apis/wit/workitems/$${encodedType}?api-version=7.0`;

  console.log("[ado] POST:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json-patch+json",
      Authorization: `Basic ${pat}`,
    },
    body: JSON.stringify(patchDocument),
  });

  const responseText = await response.text();
  console.log("[ado] Response status:", response.status);

  if (!response.ok) {
    console.error("[ado] Error:", responseText.substring(0, 500));
    throw new Error(`ADO ${response.status}: ${responseText.substring(0, 200)}`);
  }

  const result = JSON.parse(responseText);
  console.log("[ado] Created work item ID:", result.id);
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
