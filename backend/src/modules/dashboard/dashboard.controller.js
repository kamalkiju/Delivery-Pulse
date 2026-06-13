import Story from "../../models/Story.model.js";
import SlackMessage from "../../models/SlackMessage.model.js";
import Client from "../../models/Client.model.js";
import SlackWorkspace from "../../models/SlackWorkspace.model.js";

function getOrgId(req) {
  return req.user?.orgId ?? req.user?.organisationId;
}

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
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const filter = { organisationId };

    const [
      totalStories,
      pendingStories,
      approvedStories,
      adoStories,
      totalMessages,
      slackWorkspaces,
    ] = await Promise.all([
      Story.countDocuments(filter),
      Story.countDocuments({ ...filter, status: "pending-review" }),
      Story.countDocuments({ ...filter, status: "approved" }),
      Story.countDocuments({
        ...filter,
        status: "pushed-to-ado",
        adoId: { $exists: true, $ne: null },
      }),
      SlackMessage.countDocuments(filter),
      SlackWorkspace.countDocuments({ organisationId, isActive: true }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStories = await Story.countDocuments({
      ...filter,
      createdAt: { $gte: today },
    });

    const todayMessages = await SlackMessage.countDocuments({
      ...filter,
      createdAt: { $gte: today },
    });

    const aiGeneratedStories = await Story.countDocuments({
      ...filter,
      isAIGenerated: true,
    });

    console.log(
      "[dashboard-stats] total:",
      totalStories,
      "pending:",
      pendingStories,
      "approved:",
      approvedStories,
      "ado:",
      adoStories,
    );

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
        aiGeneratedStories,
        connectedWorkspaces: slackWorkspaces,
      },
    });
  } catch (error) {
    console.error("[dashboard-stats] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardActivity = async (req, res) => {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const filter = { organisationId };

    const recentStories = await Story.find(filter)
      .populate("clientId", "name company")
      .sort({ createdAt: -1 })
      .limit(5);

    const recentMessages = await SlackMessage.find(filter)
      .populate("clientId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    const activity = [];

    recentStories.forEach((story) => {
      activity.push({
        id: story._id,
        type: "story_created",
        title: story.storyTitle || story.title,
        description: `${story.type} • ${story.priority} priority`,
        source: story.source,
        client: story.clientId?.name || "Unknown Client",
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
        title: text.length > 60 ? `${text.substring(0, 60)}...` : text || "Slack message",
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
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const orgFilter = { organisationId };
    const clients = await Client.find(orgFilter).limit(10);

    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const clientFilter = {
          ...orgFilter,
          clientId: client._id,
        };

        const [
          totalStories,
          pendingStories,
          approvedStories,
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
            status: { $in: ["approved", "pushed-to-ado"] },
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

        const responseScore = totalMessages > 0 ? 80 : 50;

        const openIssues = pendingStories;
        const openIssueScore = openIssues === 0 ? 30
          : openIssues <= 5 ? 20
            : openIssues <= 10 ? 10
              : 0;

        const deliveryScore = Math.round(deliveryRate * 0.4);
        const healthScore = Math.min(
          100,
          responseScore * 0.3 + deliveryScore + openIssueScore,
        );

        return {
          _id: client._id,
          name: client.name,
          company: client.company,
          totalStories,
          pendingStories,
          approvedStories,
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

    res.json({ success: true, clients: clientsWithStats });
  } catch (error) {
    console.error("[dashboard-clients] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSprintHealth = async (req, res) => {
  try {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      return res.status(400).json({ success: false, message: "Missing organisation" });
    }

    const filter = { organisationId };

    const sprintStories = await Story.find({
      ...filter,
      sprint: { $in: ["Current", "Next"] },
    });

    const currentSprint = sprintStories.filter((s) => s.sprint === "Current");
    const nextSprint = sprintStories.filter((s) => s.sprint === "Next");

    const currentTotal = currentSprint.length;
    const currentDone = currentSprint.filter((s) =>
      s.status === "pushed-to-ado" || s.status === "done",
    ).length;
    const currentInProgress = currentSprint.filter((s) =>
      s.status === "in-progress",
    ).length;
    const currentToDo = currentSprint.filter((s) =>
      s.status === "pending-review" || s.status === "approved",
    ).length;

    const velocity = currentTotal > 0
      ? Math.round((currentDone / currentTotal) * 100)
      : 0;

    res.json({
      success: true,
      sprintHealth: {
        currentSprint: {
          total: currentTotal,
          done: currentDone,
          inProgress: currentInProgress,
          toDo: currentToDo,
          velocity,
        },
        nextSprint: {
          total: nextSprint.length,
          planned: nextSprint.filter((s) => s.status === "approved").length,
        },
      },
    });
  } catch (error) {
    console.error("[dashboard-sprint] error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
