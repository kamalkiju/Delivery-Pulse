// ─────────────────────────────────────────────────────────────────────────────
// ai.service.js — Claude API integration (DeliveryPulse “brain”)
//
// Claude = Anthropic’s AI. We send the client’s Slack text (+ optional screenshot)
// and get back JSON describing a Bug/Story, title, priority, and acceptance criteria.
// That JSON becomes a draft work item in the Review Queue.
// ─────────────────────────────────────────────────────────────────────────────

// Official SDK — handles HTTP, auth headers, and request format for Anthropic
import Anthropic from "@anthropic-ai/sdk";
// Used only to download screenshot bytes before sending them to Claude Vision
import axios from "axios";

// Create one client for the whole app; apiKey comes from backend/.env CLAUDE_API_KEY
const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/** Safe defaults if Claude is down, key is missing, or JSON parsing fails */
function buildFallbackResult(messageText) {
  const safeText = messageText ?? "";
  return {
    type: "Story",
    title: safeText.substring(0, 50) || "Client message",
    description: safeText,
    priority: "Medium",
    acceptanceCriteria: [],
    isRegression: false,
    suggestedSprint: "Backlog",
  };
}

/**
 * analyzeMessage — classify a client message and extract story fields.
 *
 * @param {{ text: string, imageUrl?: string | null, clientName?: string }} params
 * @returns {Promise<object>} Structured story fields for story.service.js
 */
export async function analyzeMessage({
  text,
  imageUrl = null,
  clientName = "Client",
}) {
  const messageText = (text ?? "").trim();

  // No API key → skip Claude and return defaults (dev / misconfiguration)
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey || apiKey === "your_claude_api_key_here") {
    console.warn("[ai] CLAUDE_API_KEY missing — using fallback story fields");
    return buildFallbackResult(messageText);
  }

  // Instructions for Claude: return ONLY JSON, no markdown or extra commentary
  const prompt = `You are an expert IT project analyst for a software delivery company. Analyze this client message carefully.

Classification rules:
- If message mentions: error, bug, not working, broken, crash, failed, 500, 404, exception → type = "Bug"
- If message mentions: new feature, add, create, build, need, want, require → type = "Feature"
- If message mentions: as a user, user story, should be able to → type = "Story"
- Otherwise → type = "Task"

Priority rules:
- Critical: system down, 500 error, cannot login, production broken, urgent, ASAP
- High: major feature broken, blocks many users
- Medium: feature issue but workaround exists
- Low: minor UI, enhancement, nice to have

Return ONLY valid JSON:
{
  "type": "Bug",
  "title": "Login returning 500 Internal Server Error",
  "description": "The login page is returning a 500 error. Users are unable to log in to the system.",
  "priority": "Critical",
  "acceptanceCriteria": [
    "Login page loads without errors",
    "Users can successfully authenticate",
    "No 500 errors in server logs"
  ],
  "suggestedSprint": "Current"
}

Client (${clientName}) message: "${messageText || "(no text — see attached image if any)"}"`;

  // Claude messages API expects an array of content blocks (text + optional image)
  const content = [{ type: "text", text: prompt }];

  // Optional screenshot: download → base64 → Vision block so Claude can read UI/errors
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
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      });

      content.push({
        type: "text",
        text: `Analyze the attached screenshot. Extract error messages, page names, error codes, and what appears broken.`,
      });
    } catch (imageError) {
      console.warn("[ai] Image download failed:", imageError.message);
    }
  }

  try {
    // messages.create = send user message to Claude and receive assistant reply
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    });

    // First content block is usually the text reply
    const responseText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const clean = responseText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(clean);

    return {
      type: result.type ?? "Story",
      title: result.title ? result.title : (messageText.substring(0, 50) || "Client message"),
      description: result.description ?? messageText,
      priority: result.priority ?? "Medium",
      acceptanceCriteria: Array.isArray(result.acceptanceCriteria)
        ? result.acceptanceCriteria
        : [],
      isRegression: Boolean(result.isRegression),
      suggestedSprint: result.suggestedSprint ?? "Backlog",
    };
  } catch (error) {
    console.error("[ai] Claude API or parse error:", error.message);
    return buildFallbackResult(messageText);
  }
}

export default { analyzeMessage };
