export const sendTeamsNotification = async ({
  assigneeName,
  assigneeEmail,
  storyTitle,
  description,
  priority,
  type,
  sprint,
  acceptanceCriteria,
  adoId,
  adoUrl,
  tags,
  approvedBy,
  clientName,
}) => {
  try {
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log("[teams] TEAMS_WEBHOOK_URL not configured - skipping");
      return false;
    }

    console.log("[teams] Sending notification to Teams...");

    const priorityEmoji = {
      Critical: "🔴",
      High: "🟠",
      Medium: "🟡",
      Low: "🟢",
    }[priority] || "🔵";

    const acList = (acceptanceCriteria || [])
      .slice(0, 3)
      .map((ac, i) => {
        const id = typeof ac === "object"
          ? (ac.id || `AC ${i + 1}`)
          : `AC ${i + 1}`;
        const scenario = typeof ac === "string"
          ? ac
          : (ac.scenario || "");
        return {
          type: "TextBlock",
          text: `**${id}:** ${scenario}`,
          wrap: true,
          size: "Small",
          color: "Default",
          spacing: "Small",
        };
      });

    const adaptiveCard = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "Container",
                style: "emphasis",
                items: [
                  {
                    type: "ColumnSet",
                    columns: [
                      {
                        type: "Column",
                        width: "auto",
                        items: [
                          {
                            type: "TextBlock",
                            text: "📬",
                            size: "ExtraLarge",
                          },
                        ],
                      },
                      {
                        type: "Column",
                        width: "stretch",
                        items: [
                          {
                            type: "TextBlock",
                            text: "New Task Assigned",
                            weight: "Bolder",
                            size: "Large",
                            color: "Accent",
                          },
                          {
                            type: "TextBlock",
                            text: `Hi **${assigneeName || assigneeEmail}**, a new work item has been assigned to you.`,
                            wrap: true,
                            size: "Small",
                            spacing: "None",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "Container",
                spacing: "Medium",
                items: [
                  {
                    type: "FactSet",
                    facts: [
                      {
                        title: "ADO ID",
                        value: adoId ? `#${adoId}` : "Pending",
                      },
                      {
                        title: "Priority",
                        value: `${priorityEmoji} ${priority || "Medium"}`,
                      },
                      {
                        title: "Type",
                        value: type || "Story",
                      },
                      {
                        title: "Sprint",
                        value: sprint || "Current",
                      },
                      {
                        title: "Client",
                        value: clientName || "N/A",
                      },
                      {
                        title: "Approved By",
                        value: approvedBy || "BA",
                      },
                    ],
                  },
                ],
              },
              {
                type: "Container",
                style: "default",
                spacing: "Medium",
                items: [
                  {
                    type: "TextBlock",
                    text: "📋 Story Title",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  {
                    type: "TextBlock",
                    text: storyTitle || "Untitled Story",
                    wrap: true,
                    size: "Default",
                    spacing: "Small",
                  },
                ],
              },
              {
                type: "Container",
                spacing: "Medium",
                items: [
                  {
                    type: "TextBlock",
                    text: "📝 Description",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  {
                    type: "TextBlock",
                    text: description || "No description provided",
                    wrap: true,
                    size: "Small",
                    color: "Default",
                    spacing: "Small",
                    isSubtle: true,
                  },
                ],
              },
              acList.length > 0 ? {
                type: "Container",
                spacing: "Medium",
                items: [
                  {
                    type: "TextBlock",
                    text: "🎯 Acceptance Criteria",
                    weight: "Bolder",
                    size: "Medium",
                  },
                  ...acList,
                ],
              } : null,
              tags?.length > 0 ? {
                type: "Container",
                spacing: "Small",
                items: [
                  {
                    type: "TextBlock",
                    text: `🏷️ Tags: ${tags.join(", ")}`,
                    size: "Small",
                    color: "Accent",
                    wrap: true,
                  },
                ],
              } : null,
            ].filter(Boolean),
            actions: [
              adoUrl ? {
                type: "Action.OpenUrl",
                title: "🔗 View in Azure DevOps",
                url: adoUrl,
                style: "positive",
              } : null,
              {
                type: "Action.OpenUrl",
                title: "📊 Open DeliveryPulse",
                url: process.env.FRONTEND_URL || "https://delivery-pulse-tau.vercel.app",
                style: "default",
              },
            ].filter(Boolean),
          },
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adaptiveCard),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[teams] Error:", response.status, errText);
      return false;
    }

    console.log("[teams] Notification sent successfully");
    return true;
  } catch (error) {
    console.error("[teams] Failed:", error.message);
    return false;
  }
};

/** @deprecated Use sendTeamsNotification — kept for story.service compatibility */
export async function notifyDeveloper(story) {
  return sendTeamsNotification({
    assigneeName: story.assigneeName || story.assignee,
    assigneeEmail: story.assignee,
    storyTitle: story.storyTitle || story.title,
    description: story.description,
    priority: story.priority,
    type: story.type,
    sprint: story.sprint,
    acceptanceCriteria: story.acceptanceCriteriaFormatted || story.acceptanceCriteria || [],
    adoId: story.adoId,
    adoUrl: story.adoUrl,
    tags: story.tags || [],
    approvedBy: "BA",
    clientName: story.clientId?.name || "Client",
  });
}

export default { sendTeamsNotification, notifyDeveloper };
