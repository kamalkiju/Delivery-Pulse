import Story from "../../models/Story.model.js";
import SlackMessage from "../../models/SlackMessage.model.js";

const getAllOrgIds = async () => {
  try {
    const SlackWorkspace = (await import("../../models/SlackWorkspace.model.js")).default;
    const workspaces = await SlackWorkspace.find({});
    return [...new Set(workspaces.map((w) => w.organisationId?.toString()).filter(Boolean))];
  } catch {
    return [];
  }
};

const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const getDashboardStats = async (req, res) => {
  try {
    const orgIds = await getAllOrgIds();
    const userOrgId = (req.user?.orgId ?? req.user?.organisationId)?.toString();
    if (userOrgId && !orgIds.includes(userOrgId)) {
      orgIds.push(userOrgId);
    }

    console.log("[dashboard-stats] searching orgIds:", orgIds);

    const filter = orgIds.length > 0
      ? { organisationId: { $in: orgIds } }
      : {};

    const [
      totalStories,
      pendingStories,
      approvedStories,
      adoStories,
      totalMessages,
      aiStories,
    ] = await Promise.all([
      Story.countDocuments(filter),
      Story.countDocuments({ ...filter, status: "pending-review" }),
      Story.countDocuments({
        ...filter,
        status: { $in: ["approved", "pushed-to-ado"] },
      }),
      Story.countDocuments({
        ...filter,
        adoId: { $exists: true, $ne: null },
      }),
      SlackMessage.countDocuments({}),
      Story.countDocuments({ ...filter, isAIGenerated: true }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStories, todayMessages] = await Promise.all([
      Story.countDocuments({
        ...filter,
        createdAt: { $gte: today },
      }),
      SlackMessage.countDocuments({
        createdAt: { $gte: today },
      }),
    ]);

    const slackStories = await Story.countDocuments({
      ...filter,
      source: "slack",
    });

    const docStories = await Story.countDocuments({
      ...filter,
      source: "document",
    });

    let connectedWorkspaces = 0;
    try {
      const SlackWorkspace = (await import("../../models/SlackWorkspace.model.js")).default;
      connectedWorkspaces = await SlackWorkspace.countDocuments({ isActive: true });
    } catch {
      // ignore
    }

    console.log("[dashboard-stats]", {
      totalStories,
      pendingStories,
      approvedStories,
      adoStories,
      totalMessages,
      todayStories,
      todayMessages,
      slackStories,
      docStories,
      aiStories,
      connectedWorkspaces,
    });

    res.json({
      success: true,
      stats: {
        totalStories,
        pendingReview: pendingStories,
        approved: approvedStories,
        pushedToADO: adoStories,
        totalMessages,
        todayStories,
        todayMessages,
        aiGeneratedStories: aiStories,
        slackStories,
        documentStories: docStories,
        connectedWorkspaces,
      },
    });
  } catch (error) {
    console.error("[dashboard-stats] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardActivity = async (req, res) => {
  try {
    const orgIds = await getAllOrgIds();
    const userOrgId = (req.user?.orgId ?? req.user?.organisationId)?.toString();
    if (userOrgId && !orgIds.includes(userOrgId)) {
      orgIds.push(userOrgId);
    }

    const filter = orgIds.length > 0
      ? { organisationId: { $in: orgIds } }
      : {};

    const [recentStories, recentMessages] = await Promise.all([
      Story.find(filter)
        .populate("clientId", "name company")
        .sort({ createdAt: -1 })
        .limit(5),
      SlackMessage.find({})
        .populate("clientId", "name")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const activity = [];

    recentStories.forEach((story) => {
      activity.push({
        id: story._id,
        type: "story_created",
        title: story.storyTitle || story.title || "Untitled Story",
        description: `${story.type} • ${story.priority}`,
        source: story.source,
        client: story.clientId?.name || "Client",
        status: story.status,
        adoId: story.adoId,
        isAIGenerated: story.isAIGenerated,
        createdAt: story.createdAt,
        timeAgo: getTimeAgo(story.createdAt),
      });
    });

    recentMessages.forEach((msg) => {
      const text = msg.messageText || "";
      activity.push({
        id: msg._id,
        type: "message_received",
        title: text.substring(0, 60) + (text.length > 60 ? "..." : ""),
        description: `From ${msg.channelName || "Slack"}`,
        source: "slack",
        client: msg.clientId?.name || "Client",
        aiProcessed: msg.aiProcessed,
        createdAt: msg.createdAt,
        timeAgo: getTimeAgo(msg.createdAt),
      });
    });

    activity.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      activity: activity.slice(0, 10),
    });
  } catch (error) {
    console.error("[dashboard-activity] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardClients = async (req, res) => {
  try {
    let Client;
    try {
      Client = (await import("../../models/Client.model.js")).default;
    } catch {
      return res.json({ success: true, clients: [] });
    }

    const clients = await Client.find({}).limit(10);

    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const clientFilter = { clientId: client._id };

        const [
          totalStories,
          pendingStories,
          adoStories,
          totalMessages,
        ] = await Promise.all([
          Story.countDocuments(clientFilter),
          Story.countDocuments({
            ...clientFilter,
            status: "pending-review",
          }),
          Story.countDocuments({
            ...clientFilter,
            adoId: { $exists: true, $ne: null },
          }),
          SlackMessage.countDocuments(clientFilter),
        ]);

        const deliveryRate = totalStories > 0
          ? Math.round((adoStories / totalStories) * 100)
          : 0;

        const responseScore = totalMessages > 0 ? 24 : 15;
        const deliveryScore = Math.round(deliveryRate * 0.4);
        const openIssueScore = pendingStories === 0 ? 30
          : pendingStories <= 5 ? 20
            : pendingStories <= 10 ? 10
              : 0;

        const healthScore = Math.min(
          100,
          responseScore + deliveryScore + openIssueScore,
        );

        return {
          _id: client._id,
          name: client.name,
          company: client.company,
          totalStories,
          pendingStories,
          adoStories,
          totalMessages,
          deliveryRate,
          healthScore: Math.round(healthScore),
          status: healthScore >= 80 ? "healthy"
            : healthScore >= 60 ? "at-risk"
              : "critical",
        };
      }),
    );

    const filtered = clientsWithStats.filter((c) =>
      c.totalStories > 0 || c.totalMessages > 0,
    );

    res.json({ success: true, clients: filtered });
  } catch (error) {
    console.error("[dashboard-clients] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSprintHealth = async (req, res) => {
  try {
    const orgIds = await getAllOrgIds();
    const userOrgId = (req.user?.orgId ?? req.user?.organisationId)?.toString();
    if (userOrgId && !orgIds.includes(userOrgId)) {
      orgIds.push(userOrgId);
    }

    const filter = orgIds.length > 0
      ? { organisationId: { $in: orgIds } }
      : {};

    const sprintStories = await Story.find({
      ...filter,
      sprint: { $in: ["Current", "Next"] },
    });

    const current = sprintStories.filter((s) => s.sprint === "Current");
    const next = sprintStories.filter((s) => s.sprint === "Next");

    const done = current.filter((s) =>
      ["pushed-to-ado", "done", "approved"].includes(s.status),
    ).length;

    const inProgress = current.filter((s) =>
      s.status === "in-progress",
    ).length;

    const toDo = current.filter((s) =>
      ["pending-review"].includes(s.status),
    ).length;

    const velocity = current.length > 0
      ? Math.round((done / current.length) * 100)
      : 0;

    res.json({
      success: true,
      sprintHealth: {
        currentSprint: {
          total: current.length,
          done,
          inProgress,
          toDo,
          velocity,
        },
        nextSprint: {
          total: next.length,
          planned: next.filter((s) => s.status === "approved").length,
        },
      },
    });
  } catch (error) {
    console.error("[dashboard-sprint] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
