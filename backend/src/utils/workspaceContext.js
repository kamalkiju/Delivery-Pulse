// workspaceContext.js — resolve x-workspace-id header for multi-workspace isolation
//
// Sidebar sends MongoDB SlackWorkspace._id on every API call.
// Controllers use this helper to scope queries to one Slack team when present.

import SlackWorkspace from "../models/SlackWorkspace.model.js";

/**
 * Read workspace id from request (header preferred, query fallback).
 * @param {import('express').Request} req
 */
export function getWorkspaceIdFromRequest(req) {
  const headerId = req.headers["x-workspace-id"];
  if (headerId && String(headerId).trim()) {
    return String(headerId).trim();
  }
  if (req.query?.workspaceId) {
    return String(req.query.workspaceId).trim();
  }
  return null;
}

/**
 * Resolve header id → SlackWorkspace doc + teamId for MongoDB filters.
 * Returns null teamId when no header (org-wide view).
 */
export async function resolveWorkspaceContext(req, organisationId) {
  const workspaceId = getWorkspaceIdFromRequest(req);

  if (!workspaceId) {
    return { workspaceId: null, teamId: null, workspace: null };
  }

  const workspace = await SlackWorkspace.findOne({
    _id: workspaceId,
    organisationId,
    isActive: true,
  }).lean();

  if (!workspace) {
    return { workspaceId, teamId: null, workspace: null, notFound: true };
  }

  return {
    workspaceId: workspace._id.toString(),
    teamId: workspace.teamId,
    workspace,
  };
}
