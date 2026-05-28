// slack.channels.js — channel list helper (uses SlackWorkspace model)

import axios from "axios";

import SlackWorkspace from "../../models/SlackWorkspace.model.js";

/**
 * getChannels — list channels from the most recent active workspace for an org.
 * Prefer GET /api/slack/workspaces/:id/channels for multi-workspace UI.
 */
export async function getChannels(organisationId, workspaceId = null) {
  const query = { organisationId, isActive: true };
  if (workspaceId) {
    query._id = workspaceId;
  }

  const workspace = await SlackWorkspace.findOne(query).sort({
    connectedAt: -1,
  });

  if (!workspace) {
    return [];
  }

  const { data } = await axios.get(
    "https://slack.com/api/conversations.list",
    {
      params: {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
      },
      headers: { Authorization: `Bearer ${workspace.accessToken}` },
    },
  );

  if (!data.ok) {
    const err = new Error(data.error ?? "Failed to list Slack channels");
    err.statusCode = 502;
    throw err;
  }

  return (data.channels ?? []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    memberCount: ch.num_members ?? 0,
    isPrivate: Boolean(ch.is_private),
  }));
}

export async function fetchTeamInfo(botToken) {
  const { data } = await axios.get("https://slack.com/api/team.info", {
    headers: { Authorization: `Bearer ${botToken}` },
  });

  if (!data.ok) {
    return { teamIcon: null };
  }

  const icon = data.team?.icon?.image_132 ?? data.team?.icon?.image_68 ?? null;
  return { teamIcon: icon };
}
