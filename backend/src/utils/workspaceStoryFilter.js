// workspaceStoryFilter.js — limit Story queries to one Slack workspace (teamId)

import SlackMessage from "../models/SlackMessage.model.js";

/**
 * When x-workspace-id is set, only include stories tied to that workspace's Slack team:
 * - storyId on SlackMessage for that teamId
 * - source slack + sourceRef pointing at a message in that team
 */
export async function buildWorkspaceStoryFilter(organisationId, teamId) {
  if (!teamId) {
    return {};
  }

  const messages = await SlackMessage.find({ organisationId, teamId })
    .select("_id storyId")
    .lean();

  const storyIds = messages
    .map((m) => m.storyId)
    .filter(Boolean)
    .map((id) => id.toString());

  const messageRefIds = messages.map((m) => m._id.toString());

  return {
    $or: [
      { _id: { $in: storyIds } },
      { source: "slack", sourceRef: { $in: messageRefIds } },
    ],
  };
}
