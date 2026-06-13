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
  const acceptanceCriteriaFormatted = [
    {
      id: "AC 1",
      scenario:
        "Given the user is on the affected screen When they perform the reported action Then the system responds as expected",
    },
    {
      id: "AC 2",
      scenario:
        "Given invalid or edge-case input When the user submits the form Then appropriate validation messages are shown",
    },
    {
      id: "AC 3",
      scenario:
        "Given the fix is deployed When the user repeats the original steps Then the issue no longer occurs",
    },
  ];
  return {
    storyTitle: `DeliveryPulse > General > ${safeText.substring(0, 50)}`,
    type: "Story",
    title: `DeliveryPulse > General > ${safeText.substring(0, 50)}`,
    priority: "Medium",
    description: `As a user I need ${safeText} So that the system works correctly`,
    acceptanceCriteria: acceptanceCriteriaFormatted.map((ac) => ac.scenario),
    acceptanceCriteriaFormatted,
    releaseNotes: `We addressed the client requirement: ${safeText}`,
    releaseNotesText: `We addressed the client requirement: ${safeText}`,
    businessRequirement: safeText,
    userFlow: "",
    uiBehavior: "",
    validations: [],
    tags: [],
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

  const prompt = `You are a senior Business Analyst.
A client sent this Slack message. Convert it to a 
complete ADO user story.

Return ONLY raw JSON - no markdown - no code blocks:
{
  "storyTitle": "ProjectName > Module > Feature Name",
  "type": "Bug or Story or Feature or Task",
  "priority": "Critical or High or Medium or Low",
  "description": "As a [specific user role] I need [specific feature] So that [specific business value]",
  "adoDescription": {
    "businessRequirement": "What business problem this client message describes",
    "userFlow": "Step by step how user interacts with this feature",
    "uiBehavior": "How the UI should look and behave",
    "validations": [
      "Validation rule 1",
      "Validation rule 2"
    ]
  },
  "acceptanceCriteria": [
    {
      "id": "AC 1",
      "scenario": "Given [initial context/precondition] When [specific user action] Then [expected system response]"
    },
    {
      "id": "AC 2",
      "scenario": "Given [initial context/precondition] When [specific user action] Then [expected system response]"
    },
    {
      "id": "AC 3",
      "scenario": "Given [initial context/precondition] When [specific user action] Then [expected system response]"
    }
  ],
  "sprint": "Current or Next or Backlog",
  "tags": ["relevant-tag-1", "relevant-tag-2"],
  "releaseNotes": "We introduced [feature] to [solve problem]. This meets [requirement]."
}

STRICT RULES FOR ACCEPTANCE CRITERIA:
1. EVERY AC must follow EXACTLY this format:
   "Given [context] When [action] Then [result]"
2. NEVER write AC as just a statement
3. ALWAYS have minimum 3 acceptance criteria
4. Make AC specific to the client message content
5. AC must be testable and verifiable

TYPE RULES:
- Bug: error, not working, broken, 500, crash, failed, wrong, issue
- Feature: new feature, add, introduce, build, create, need a
- Story: need to, should be able to, requirement, update, improve
- Task: update, change, modify, fix, configure

PRIORITY RULES:
- Critical: system down, cannot login, production broken, urgent, ASAP
- High: major feature broken, blocks users, important
- Medium: enhancement, update needed, improvement
- Low: minor change, nice to have

Client name: "${clientName}"
Client Slack message: "${messageText || "(no text — see attached image if any)"}"

Analyze the message carefully.
Generate a complete professional ADO story.
Return ONLY the JSON object. No other text.`;

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
    console.log("[ai] using model: claude-haiku-4-5");
    const response = await claude.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
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

    const adoDescription = result.adoDescription ?? {};

    const rawACs = Array.isArray(result.acceptanceCriteria)
      ? result.acceptanceCriteria
      : [];

    const acceptanceCriteria = rawACs
      .map((ac) => (typeof ac === "string" ? ac : ac.scenario || ""))
      .filter(Boolean);

    const acceptanceCriteriaFormatted = rawACs
      .map((ac, i) => ({
        id: (typeof ac === "object" && ac.id) ? ac.id : `AC ${i + 1}`,
        scenario: typeof ac === "string" ? ac : ac.scenario || "",
      }))
      .filter((ac) => ac.scenario);

    return {
      storyTitle,
      type: result.type ?? "Story",
      title: storyTitle,
      description: result.description ?? messageText,
      priority: result.priority ?? "Medium",
      acceptanceCriteria,
      acceptanceCriteriaFormatted,
      releaseNotes: result.releaseNotes ?? "",
      businessRequirement: adoDescription.businessRequirement
        ?? result.businessRequirement ?? "",
      userFlow: adoDescription.userFlow ?? result.userFlow ?? "",
      uiBehavior: adoDescription.uiBehavior ?? result.uiBehavior ?? "",
      validations: adoDescription.validations ?? result.validations ?? [],
      tags: Array.isArray(result.tags) ? result.tags : [],
      isRegression: false,
      suggestedSprint: result.sprint ?? "Backlog",
    };
  } catch (error) {
    console.error("[ai] Claude API or parse error:", error.message);
    return buildFallbackResult(messageText);
  }
}

export default { analyzeMessage };
