// ─────────────────────────────────────────────────────────────────────────────
// ado.service.js — Azure DevOps (ADO) integration
//
// ADO is Microsoft’s project tool (like Jira). DeliveryPulse pushes approved
// stories there so developers work in the same place as your client delivery team.
//
// ADO REST API basics:
//   • Authentication = Basic auth with a Personal Access Token (PAT)
//   • Create work item = POST with JSON Patch body (not regular JSON)
//   • Work item types in ADO often differ from our labels (Bug vs User Story)
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { Buffer } from "node:buffer";

// ADO uses Basic auth: username is empty, password is your PAT — encoded as base64
const adoToken = Buffer.from(`:${process.env.ADO_TOKEN ?? ""}`).toString(
  "base64",
);

const adoBaseUrl = `https://dev.azure.com/${process.env.ADO_ORG}/${process.env.ADO_PROJECT}`;

/** True when PAT and project are set — otherwise story.service uses a mock id in dev */
function isAdoConfigured() {
  const token = process.env.ADO_TOKEN;
  return (
    process.env.ADO_ORG &&
    process.env.ADO_PROJECT &&
    token &&
    token !== "your_ado_personal_access_token"
  );
}

/**
 * createWorkItem — create a work item in ADO from an approved DeliveryPulse story.
 *
 * Called from: story.service.js → approveStory (after BA clicks Approve).
 *
 * @param {import("../../models/Story.model.js").default} story
 * @returns {Promise<number|string>} ADO work item id (saved on Story.adoId)
 */
export async function createWorkItem(story) {
  if (!isAdoConfigured()) {
    console.warn("[ado] ADO not configured — using mock work item id");
    return `MOCK-${story._id.toString().slice(-6).toUpperCase()}`;
  }

  try {
    // Step 1 — Map story type to ADO work item type
    // ADO uses different names than our internal types (e.g. Story → User Story)
    const workItemType =
      {
        Bug: "Bug",
        Story: "User Story",
        Task: "Task",
        Feature: "Feature",
      }[story.type] ?? "User Story";

    // Step 2 — Map priority to ADO priority number (1 = highest, 4 = lowest)
    const priorityMap = {
      Critical: 1,
      High: 2,
      Medium: 3,
      Low: 4,
    };
    const adoPriority = priorityMap[story.priority] ?? 3;

    // Step 3 — Build acceptance criteria HTML
    // ADO description field accepts HTML — bullet list for BA criteria
    const criteria = story.acceptanceCriteria ?? [];
    const acHtml = criteria.map((item) => `<li>${item}</li>`).join("");
    const acFormatted = criteria.length > 0 ? `<ul>${acHtml}</ul>` : "";

    const descriptionBody = [story.description ?? "", acFormatted]
      .filter(Boolean)
      .join("<br/><br/>");

    // Step 4 — Build patch document for ADO API
    // Each { op, path, value } updates one field on the new work item
    const patchDocument = [
      { op: "add", path: "/fields/System.Title", value: story.title },
      {
        op: "add",
        path: "/fields/System.Description",
        value: descriptionBody,
      },
      {
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: adoPriority,
      },
      {
        op: "add",
        path: "/fields/System.Tags",
        value: "DeliveryPulse; AI Generated",
      },
      {
        op: "add",
        path: "/fields/System.AreaPath",
        value: process.env.ADO_PROJECT,
      },
    ];

    // Step 5 — Call ADO REST API
    // $WorkItemType in the URL is required — encode spaces (e.g. User Story)
    const url = `${adoBaseUrl}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.0`;

    const response = await axios.post(url, patchDocument, {
      headers: {
        // ADO requires this content type for work item create/update (JSON Patch)
        "Content-Type": "application/json-patch+json",
        Authorization: `Basic ${adoToken}`,
      },
    });

    // Step 6 — Return ADO work item ID (stored on Story.adoId in MongoDB)
    return response.data.id;
  } catch (error) {
    const adoBody = error.response?.data;
    console.error(
      "[ado] Failed to create work item:",
      adoBody ?? error.message,
    );
    const err = new Error("Failed to create ADO work item");
    err.cause = error;
    err.adoResponse = adoBody;
    throw err;
  }
}

/**
 * updateWorkItemStatus — change ADO state when progress updates (e.g. from Teams).
 *
 * Called from: future Teams / status webhook handlers (not wired in UI yet).
 *
 * @param {number|string} adoId — Azure DevOps work item id
 * @param {string} status — DeliveryPulse status (in-progress, done, blocked, …)
 */
export async function updateWorkItemStatus(adoId, status) {
  if (!isAdoConfigured()) {
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

  try {
    const url = `${adoBaseUrl}/_apis/wit/workitems/${adoId}?api-version=7.0`;

    const patchDocument = [
      { op: "add", path: "/fields/System.State", value: adoState },
    ];

    await axios.patch(url, patchDocument, {
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: `Basic ${adoToken}`,
      },
    });
  } catch (error) {
    const adoBody = error.response?.data;
    console.error(
      "[ado] Failed to update work item status:",
      adoBody ?? error.message,
    );
    const err = new Error("Failed to update ADO work item status");
    err.cause = error;
    err.adoResponse = adoBody;
    throw err;
  }
}

export default { createWorkItem, updateWorkItemStatus };
