// clients.controller.js — GET /api/clients and GET /api/clients/:id

import Client from "../../models/Client.model.js";
import Story from "../../models/Story.model.js";
import SlackMessage from "../../models/SlackMessage.model.js";
import HealthScore from "../../models/HealthScore.model.js";
import Commitment from "../../models/Commitment.model.js";
import Meeting from "../../models/Meeting.model.js";

function getOrgId(req) {
  return req.user?.orgId ?? req.user?.organisationId;
}

/** GET /api/clients — all clients for this organisation */
export async function getClients(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const clients = await Client.find({ organisationId }).sort({ name: 1 }).lean();

    return res.json(
      clients.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        company: c.company,
        healthScore: c.healthScore ?? 100,
        status: c.status ?? "healthy",
        contractValue: c.contractValue ?? null,
        projectName: c.projectName ?? null,
        lastActivity: c.lastActivity ?? null,
      })),
    );
  } catch (error) {
    console.error("[clients] getClients:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/** GET /api/clients/:id — full client detail with aggregated story/message/commitment data */
export async function getClientById(req, res) {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const clientId = req.params.id;
    const client = await Client.findOne({ _id: clientId, organisationId }).lean();

    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const [healthHistory, stories, messages, commitments, meetingCount] =
      await Promise.all([
        HealthScore.find({ clientId: client._id, organisationId })
          .sort({ calculatedAt: -1 })
          .limit(8)
          .lean(),
        Story.find({ clientId: client._id, organisationId }).lean(),
        SlackMessage.find({ clientId: client._id, organisationId })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        Commitment.find({ organisationId })
          .sort({ detectedAt: -1 })
          .limit(5)
          .lean(),
        Meeting.countDocuments({ clientId: client._id, organisationId }),
      ]);

    // Oldest first so the chart reads left-to-right chronologically
    const scoreHistory = healthHistory.reverse().map((h) => h.score);
    if (scoreHistory.length === 0) scoreHistory.push(client.healthScore ?? 100);

    const bugCount = stories.filter((s) => s.type?.toLowerCase() === "bug").length;
    const featureCount = stories.filter(
      (s) => s.type?.toLowerCase() === "feature",
    ).length;
    const changeCount = stories.filter((s) =>
      ["story", "task"].includes(s.type?.toLowerCase()),
    ).length;

    return res.json({
      success: true,
      client: {
        id: client._id.toString(),
        name: client.name,
        company: client.company,
        projectName: client.projectName ?? "",
        contractValue: client.contractValue ?? "—",
        healthScore: client.healthScore ?? 100,
        status: client.status ?? "healthy",
        createdAt: client.createdAt,
        scoreHistory,
        storyCounts: {
          total: stories.length,
          bugs: bugCount,
          features: featureCount,
          changes: changeCount,
        },
        recentMessages: messages.map((m) => ({
          id: m._id.toString(),
          text: m.messageText ?? "(no text)",
          aiProcessed: m.aiProcessed ?? false,
        })),
        commitments: commitments.map((c) => ({
          id: c._id.toString(),
          text: c.commitmentText,
          status: c.status,
        })),
        meetingCount,
      },
    });
  } catch (error) {
    console.error("[clients] getClientById:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
