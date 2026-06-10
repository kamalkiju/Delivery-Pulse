import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

function buildFallbackResult(messageText) {
  const safeText = messageText ?? "";
  return {
    storyTitle: safeText.substring(0, 80) || "Client message",
    type: "Story",
    title: safeText.substring(0, 80) || "Client message",
    description: safeText,
    priority: "Medium",
    acceptanceCriteria: [],
    acceptanceCriteriaFormatted: [],
    releaseNotes: "",
    isRegression: false,
    suggestedSprint: "Backlog",
  };
}

export async function analyzeMessage({
  text,
  imageUrl = null,
  clientName = "Client",
}) {
  const messageText = (text ?? "").trim();

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey || apiKey === "your_claude_api_key_here") {
    console.warn("[ai] CLAUDE_API_KEY missing — using fallback story fields");
    return buildFallbackResult(messageText);
  }

  const prompt = `You are an expert Business Analyst for an IT services company.
A client named ${clientName} sent this message via Slack.

Analyze the message and return ONLY valid JSON with this structure:

{
  "storyTitle": "HUB>1>INC[number]>[Short feature name]",
  "type": "Bug" or "Story" or "Feature" or "Task",
  "priority": "Critical" or "High" or "Medium" or "Low",
  "description": "As a [user type] I need [what they need] So that [business value]",
  "acceptanceCriteria": [
    {
      "id": "AC 1",
      "given": "Given [precondition]",
      "when": "When [action]",
      "then": "Then [expected result]"
    },
    {
      "id": "AC 2",
      "given": "Given [precondition]",
      "when": "When [action]",
      "then": "Then [expected result]"
    },
    {
      "id": "AC 3",
      "given": "Given [precondition]",
      "when": "When [action]",
      "then": "Then [expected result]"
    }
  ],
  "releaseNotes": "We introduced [feature name] to [business reason]. This was developed to meet [requirement]. [Impact statement].",
  "sprint": "Current" or "Next" or "Backlog"
}

Classification rules:
- Bug: error, not working, broken, 500, crash, failed, issue
- Feature: new feature, add, introduce, build, create
- Story: as a user, need to, should be able to, requirement
- Task: update, change, modify, fix, improve

Priority rules:
- Critical: system down, cannot login, production broken, urgent
- High: major feature broken, blocks users
- Medium: feature issue but workaround exists
- Low: minor UI, enhancement, nice to have

Generate minimum 3 acceptance criteria in Given/When/Then format.
Make the story title meaningful based on the client message using format: HUB>1>INC[incremental number]>[Short feature name].
Make description follow "As a [user type] I need [what] So that [business value]" format exactly.

Client name: "${clientName}"
Client message: "${messageText || "(no text — see attached image if any)"}"

Return ONLY valid JSON. No markdown. No extra text.`;

  const content = [{ type: "text", text: prompt }];

  if (imageUrl) {
    try {
      const headers = {};
      if (imageUrl.includes("slack.com") && process.env.SLACK_BOT_TOKEN) {
        headers.Authorization = `Bearer ${process.env.SLACK_BOT_TOKEN}`;
      }
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers,
      });
      const base64Data = Buffer.from(imageResponse.data).toString("base64");
      const mediaType =
        imageResponse.headers["content-type"]?.split(";")[0] || "image/png";
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64Data },
      });
      content.push({
        type: "text",
        text: "Analyze the attached screenshot. Extract error messages, page names, error codes, and what appears broken.",
      });
    } catch (imageError) {
      console.warn("[ai] Image download failed:", imageError.message);
    }
  }

  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });

    const responseText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const clean = responseText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(clean);

    const storyTitle =
      result.storyTitle ??
      (messageText.substring(0, 80) || "Client message");

    const acceptanceCriteriaFormatted = Array.isArray(result.acceptanceCriteria)
      ? result.acceptanceCriteria.map((ac, i) =>
          typeof ac === "object"
            ? ac
            : { id: `AC ${i + 1}`, given: "", when: "", then: ac }
        )
      : [];

    // Flat string array for legacy acceptanceCriteria field
    const acceptanceCriteria = acceptanceCriteriaFormatted.map(
      (ac) => `${ac.id}\n${ac.given}\n${ac.when}\n${ac.then}`
    );

    return {
      storyTitle,
      type: result.type ?? "Story",
      title: storyTitle,
      description: result.description ?? messageText,
      priority: result.priority ?? "Medium",
      acceptanceCriteria,
      acceptanceCriteriaFormatted,
      releaseNotes: result.releaseNotes ?? "",
      isRegression: false,
      suggestedSprint: result.sprint ?? "Backlog",
    };
  } catch (error) {
    console.error("[ai] Claude API or parse error:", error.message);
    return buildFallbackResult(messageText);
  }
}

export default { analyzeMessage };
