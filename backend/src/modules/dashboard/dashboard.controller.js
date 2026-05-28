// dashboard.controller.js — DashboardPage API

import * as dashboardService from "../../services/dashboard/dashboard.service.js";
import { resolveWorkspaceContext } from "../../utils/workspaceContext.js";

function getOrgId(req) {
  return req.user?.orgId ?? req.user?.organisationId;
}

/** Build { teamId, workspaceId } for dashboard.service when x-workspace-id is set */
async function getDashboardWorkspaceContext(req, organisationId) {
  const wsContext = await resolveWorkspaceContext(req, organisationId);
  if (!wsContext.teamId) {
    return {};
  }
  return {
    teamId: wsContext.teamId,
    workspaceId: wsContext.workspaceId,
  };
}

export async function getStats(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }
    const workspaceContext = await getDashboardWorkspaceContext(
      req,
      organisationId,
    );
    const stats = await dashboardService.getDashboardStats(
      organisationId,
      workspaceContext,
    );
    return res.json(stats);
  } catch (error) {
    console.error("[dashboard] stats:", error);
    return res.status(500).json({ message: error.message ?? "Failed to load stats" });
  }
}

export async function getClients(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }
    const workspaceContext = await getDashboardWorkspaceContext(
      req,
      organisationId,
    );
    const clients = await dashboardService.getClientHealthList(
      organisationId,
      workspaceContext,
    );
    return res.json(clients);
  } catch (error) {
    console.error("[dashboard] clients:", error);
    return res.status(500).json({ message: error.message ?? "Failed to load clients" });
  }
}

export async function getActivity(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }
    const workspaceContext = await getDashboardWorkspaceContext(
      req,
      organisationId,
    );
    const activity = await dashboardService.getAIActivityFeed(
      organisationId,
      workspaceContext,
    );
    return res.json(activity);
  } catch (error) {
    console.error("[dashboard] activity:", error);
    return res.status(500).json({ message: error.message ?? "Failed to load activity" });
  }
}

export async function getSprintHealth(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }
    const workspaceContext = await getDashboardWorkspaceContext(
      req,
      organisationId,
    );
    const sprints = await dashboardService.getSprintHealth(
      organisationId,
      workspaceContext,
    );
    return res.json(sprints);
  } catch (error) {
    console.error("[dashboard] sprint-health:", error);
    return res.status(500).json({ message: error.message ?? "Failed to load sprint health" });
  }
}

export async function getCommitments(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }
    const commitments = await dashboardService.getVerbalCommitments(organisationId);
    return res.json(commitments);
  } catch (error) {
    console.error("[dashboard] commitments:", error);
    return res
      .status(500)
      .json({ message: error.message ?? "Failed to load commitments" });
  }
}
