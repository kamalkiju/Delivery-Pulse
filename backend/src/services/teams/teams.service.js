// teams.service.js — notify developers when a story is approved and pushed to ADO

import axios from "axios";

/**
 * notifyDeveloper — send a Teams message with task details (webhook or log in dev).
 *
 * @param {import("../../models/Story.model.js").default} story
 */
export async function notifyDeveloper(story) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

  const text =
    `New work item assigned from DeliveryPulse\n\n` +
    `**${story.title}**\n` +
    `Type: ${story.type} | Priority: ${story.priority}\n` +
    `ADO: ${story.adoId ?? "pending"}\n` +
    `Assignee: ${story.assignee ?? "Unassigned"}`;

  if (!webhookUrl) {
    console.log("[teams] TEAMS_WEBHOOK_URL not set — notification (dev log):", text);
    return;
  }

  await axios.post(webhookUrl, {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: story.title,
    themeColor: "0088FF",
    title: "DeliveryPulse — New task",
    text,
  });
}

export default { notifyDeveloper };
