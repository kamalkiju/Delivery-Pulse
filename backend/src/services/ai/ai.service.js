import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";

// Create a fresh client per call so the API key is read at request time, not module load.
const getClaudeClient = () => {
  const apiKey = process.env.CLAUDE_API_KEY;
  console.log("[ai] API key configured:", apiKey ? "YES" : "NO - MISSING");
  if (!apiKey || apiKey === "your_claude_api_key_here") {
    throw new Error("CLAUDE_API_KEY is not set in environment variables");
  }
  return new Anthropic({ apiKey });
};

function buildFallbackResult(messageText) {
  const safeText = messageText ?? "";
  return {
    storyTitle: `DeliveryPulse > General > ${safeText.substring(0, 50)}`,
    type: "Story",
    title: `DeliveryPulse > General > ${safeText.substring(0, 50)}`,
    priority: "Medium",
    description: `As a user I need ${safeText} So that the system works correctly`,
    acceptanceCriteria: [
      {
        id: "AC 1",
        scenario:
          "Given the user performs the action When the system processes it Then the expected result is shown",
      },
    ],
    acceptanceCriteriaFormatted: [
      {
        id: "AC 1",
        given: "Given the user performs the action",
        when: "When the system processes it",
        then: "Then the expected result is shown",
      },
    ],
    releaseNotes: `We addressed the client requirement: ${safeText}`,
    releaseNotesText: `We addressed the client requirement: ${safeText}`,
    isRegression: false,
    suggestedSprint: "Current",
  };
}

export async function analyzeMessage({
  text,
  imageUrl = null,
  clientName = "Client",
}) {
  const messageText = (text ?? "").trim();

  let claude;
  try {
    claude = getClaudeClient();
  } catch {
    console.warn("[ai] CLAUDE_API_KEY missing — using fallback story fields");
    return buildFallbackResult(messageText);
  }

  const prompt = `You are a senior Business Analyst working for an IT services company.
A client has sent a message via Slack that needs to be converted
into a properly formatted ADO user story.

Your job is to analyze the message and create a professional story.

Return ONLY a valid JSON object. No markdown. No explanation. Just JSON.

{
  "storyTitle": "Create a meaningful title like: DeliveryPulse > [Module] > [Feature Name]",
  "type": "Bug or Story or Feature or Task",
  "priority": "Critical or High or Medium or Low",
  "description": "As a [specific user type] I need [specific capability] So that [specific business value and outcome]",
  "acceptanceCriteria": [
    {
      "id": "AC 1",
      "scenario": "Given [the initial context or state] When [the action is performed] Then [the expected outcome]"
    },
    {
      "id": "AC 2",
      "scenario": "Given [the initial context or state] When [the action is performed] Then [the expected outcome]"
    },
    {
      "id": "AC 3",
      "scenario": "Given [the initial context or state] When [the action is performed] Then [the expected outcome]"
    }
  ],
  "releaseNotes": "We introduced [feature/fix name] to [solve what problem]. This was developed to meet [requirement]. [Business impact statement].",
  "sprint": "Current or Next or Backlog"
}

IMPORTANT RULES:
1. NEVER use the raw client message as the title
2. ALWAYS create a meaningful professional title
3. ALWAYS write description as "As a X I need Y So that Z"
4. ALWAYS generate minimum 3 acceptance criteria
5. Each AC must follow Given/When/Then format
6. Infer missing details from context intelligently

TYPE RULES:
- Bug: error, not working, broken, 500, crash, failed, wrong
- Feature: new feature, add, introduce, build, create, need a
- Story: as a user, need to, should be able to, requirement, update
- Task: update, change, modify, fix, improve, configure

PRIORITY RULES:
- Critical: system down, cannot login, production broken, urgent, ASAP
- High: major feature broken, blocks multiple users, important
- Medium: feature update, enhancement, improvement needed
- Low: minor UI change, nice to have, cosmetic

CLIENT NAME: "${clientName}"
CLIENT MESSAGE: "${messageText || "(no text — see attached image if any)"}"

Analyze the message carefully and generate a complete professional story.
Return ONLY the JSON object above with all fields filled in properly.`;

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
    console.log("[ai] using model: claude-sonnet-4-5");
    const response = await claude.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    });

    const responseText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    const clean = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(clean);

    const storyTitle =
      result.storyTitle ?? `DeliveryPulse > General > ${messageText.substring(0, 50)}`;

    // Normalise ACs — support both { id, scenario } and { id, given, when, then }
    const rawACs = Array.isArray(result.acceptanceCriteria)
      ? result.acceptanceCriteria
      : [];

    const acceptanceCriteriaFormatted = rawACs.map((ac, i) => {
      if (typeof ac === "string") {
        return { id: `AC ${i + 1}`, given: "", when: "", then: ac };
      }
      if (ac.scenario) {
        return { id: ac.id ?? `AC ${i + 1}`, given: "", when: "", then: ac.scenario };
      }
      return {
        id: ac.id ?? `AC ${i + 1}`,
        given: ac.given ?? "",
        when: ac.when ?? "",
        then: ac.then ?? "",
      };
    });

    // Flat string array for legacy acceptanceCriteria field
    const acceptanceCriteria = rawACs.map((ac) =>
      typeof ac === "string" ? ac : ac.scenario ?? `${ac.given ?? ""} ${ac.when ?? ""} ${ac.then ?? ""}`.trim()
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
