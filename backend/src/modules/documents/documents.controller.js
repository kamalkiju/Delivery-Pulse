import Anthropic from "@anthropic-ai/sdk";
import Story from "../../models/Story.model.js";
import Document from "../../models/Document.model.js";

const getClaudeClient = () => {
  const apiKey = process.env.CLAUDE_API_KEY;
  console.log("[document] API key configured:", apiKey ? "YES" : "NO - MISSING");
  if (!apiKey) throw new Error("CLAUDE_API_KEY is not set in environment variables");
  return new Anthropic({ apiKey });
};

const getOrgId = (req) => req.user?.orgId ?? req.user?.organisationId;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parse JSON from a Claude response, stripping markdown fences */
function parseChunkResponse(text) {
  let clean = text.trim()
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    return JSON.parse(clean.substring(start, end + 1));
  } catch {
    return null;
  }
}

export const uploadDocument = async (req, res) => {
  try {
    const { projectId, clientId } = req.body;
    const file = req.file;
    const organisationId =
      req.user?.organisationId ?? req.user?.orgId ?? getOrgId(req);
    const userId = req.user?.userId ?? req.user?.id;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // VALIDATION 1 — allowed file types
    const allowedTypes = ["docx", "pdf", "xlsx", "xls", "txt", "csv"];
    const fileExt = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedTypes.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        message: `File type .${fileExt} not supported. Please upload: ${allowedTypes.join(", ")}`,
      });
    }

    // VALIDATION 2 — max 10 MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB",
      });
    }

    console.log("[document] Processing:", file.originalname, "size:", file.size);

    // ── Extract text ──────────────────────────────────────────────────────────
    let documentText = "";
    const filename = file.originalname.toLowerCase();

    if (filename.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      documentText = result.value;
    } else if (filename.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(file.buffer);
      documentText = result.text;
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        documentText += `Sheet: ${sheetName}\n`;
        documentText += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
      });
    } else if (filename.endsWith(".txt") || filename.endsWith(".csv")) {
      documentText = file.buffer.toString("utf-8");
    }

    // VALIDATION 3 — minimum readable content
    if (!documentText || documentText.trim().length < 100) {
      return res.status(400).json({
        success: false,
        message:
          "Document appears to be empty or could not be read. Please check the file.",
      });
    }

    console.log("[document] Total text length:", documentText.length);

    // ── Split into chunks (with overlap to avoid missing stories at boundaries) ─
    const CHUNK_SIZE = 3000;
    const chunks = [];
    for (let i = 0; i < documentText.length; i += CHUNK_SIZE) {
      const start = Math.max(0, i - 200);
      chunks.push(documentText.substring(start, i + CHUNK_SIZE));
    }
    console.log("[document] Processing", chunks.length, "chunk(s)");

    const claude = getClaudeClient();
    let allStories = [];
    let documentSummary = "";
    let documentTitle = file.originalname;

    // ── Process each chunk ────────────────────────────────────────────────────
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const isFirst = idx === 0;
      const isLast = idx === chunks.length - 1;

      console.log(`[document] Processing chunk ${idx + 1}/${chunks.length}`);

      const prompt = `Extract user stories from this document section as JSON.

The document uses Epics as main categories.
Each Epic contains multiple user stories.
Create one story per user story found.

Look for patterns like:
- 'As a user I want...'
- 'As a [role] I need...'
- 'As a [role] I want...'
Each of these is a separate story.

Count every 'As a' statement as one story.
Do not combine multiple As-a statements into one story.

CRITICAL TITLE RULE:
Story title MUST always contain > separator.
Format: 'Epic Name > Feature Name'
For Product Vision or general requirements use:
'Product Vision > [Feature Name]'
NOT 'Product Vision: [Feature Name]'
Always use > as separator not : or -

CRITICAL DESCRIPTION RULE:
Every description MUST follow EXACTLY this format:
'As a [specific user role] I need [specific feature/capability] So that [specific business value/outcome]'

NEVER write description as:
- 'The system should...'
- 'Users can...'
- 'This feature...'
- 'Implement...'

ALWAYS start with 'As a' and include 'So that'
If you cannot identify user role use 'As a user'
If you cannot identify value use 'So that the experience is improved'

CRITICAL AC RULE:
Every story MUST have EXACTLY 3 acceptance criteria minimum.
Never create a story with 1 or 2 AC.

If you can only think of 2 AC add a third covering:
  - Error scenario: Given [error] When [action] Then [error shown]
  - OR Edge case: Given [edge case] When [action] Then [result]
  - OR Validation: Given [invalid input] When [submitted] Then [validation shown]

If you can only think of 1 AC add two more covering:
  - Happy path variant
  - Error scenario

Return ONLY this JSON structure, nothing else:
{"stories":[{"storyTitle":"User Access > Login with Email","type":"Story","priority":"Medium","description":"As a registered user I need to log in with email So that I can access my account securely","acceptanceCriteria":[{"id":"AC 1","scenario":"Given valid credentials When user logs in Then access is granted"},{"id":"AC 2","scenario":"Given invalid password When user logs in Then error message is shown"},{"id":"AC 3","scenario":"Given empty fields When user submits Then validation is shown"}],"releaseNotes":"We introduced login","sprint":"Current"}]}

Extract every requirement. Return raw JSON only.

Section ${idx + 1}/${chunks.length}:
${chunk}`;

      let attempt = 0;
      while (attempt < 2) {
        try {
          const response = await claude.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 3000,
            messages: [{ role: "user", content: prompt }],
          });

          const responseText = response.content[0].text;
          console.log(`[document] Chunk ${idx + 1} response length:`, responseText.length);
          console.log(`[document] Chunk ${idx + 1} first 300 chars:`, responseText.substring(0, 300));
          console.log(`[document] Chunk ${idx + 1} last 100 chars:`, responseText.substring(responseText.length - 100));

          // Strip markdown fences
          let cleanJson = responseText.trim()
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

          console.log(`[document] Clean json starts with:`, cleanJson.substring(0, 50));

          const jsonStart = cleanJson.indexOf("{");
          const jsonEnd = cleanJson.lastIndexOf("}");
          console.log(`[document] jsonStart: ${jsonStart}, jsonEnd: ${jsonEnd}`);

          if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
            console.log(`[document] Chunk ${idx + 1} — no valid JSON brackets found`);
            break;
          }

          const jsonStr = cleanJson.substring(jsonStart, jsonEnd + 1);
          console.log(`[document] Extracted JSON length:`, jsonStr.length);

          let chunkAnalysis;
          try {
            chunkAnalysis = JSON.parse(jsonStr);
            console.log(`[document] Parse success, stories:`, chunkAnalysis.stories?.length);
          } catch (parseErr) {
            console.error(`[document] Parse error:`, parseErr.message);
            const errPos = parseInt(parseErr.message.match(/\d+/)?.[0] || "0");
            console.error(`[document] JSON near error:`, jsonStr.substring(Math.max(0, errPos - 50), errPos + 50));
            break;
          }

          if (!chunkAnalysis?.stories?.length) {
            console.log(`[document] Chunk ${idx + 1} — parsed but no stories found`);
            console.log(`[document] Keys in response:`, Object.keys(chunkAnalysis || {}));
            break;
          }

          allStories = allStories.concat(chunkAnalysis.stories);
          console.log(`[document] Chunk ${idx + 1} → ${chunkAnalysis.stories.length} stories. Total: ${allStories.length}`);

          if (isFirst && chunkAnalysis.documentSummary) {
            documentSummary = chunkAnalysis.documentSummary;
            documentTitle = chunkAnalysis.documentTitle || documentTitle;
          }
          break; // success — move to next chunk

        } catch (err) {
          if (err.status === 429) {
            console.log(`[document] Rate limit on chunk ${idx + 1} — waiting 30s...`);
            await sleep(30000);
            attempt++;
          } else {
            console.error(`[document] Chunk ${idx + 1} error:`, err.message);
            break;
          }
        }
      }

      // Polite delay between chunks to avoid rate limits
      if (!isLast) await sleep(2000);
    }

    console.log("[document] Total stories extracted:", allStories.length);

    const seen = new Set();
    allStories = allStories.filter((story) => {
      const key = (story.storyTitle || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log("[document] After dedup:", allStories.length, "stories");

    console.log("[document] Running post-processing...");

    allStories = allStories.map((story) => {
      if (!story.storyTitle?.includes(">")) {
        story.storyTitle = story.storyTitle?.includes(":")
          ? story.storyTitle.replace(/:\s*/, " > ")
          : `General > ${story.storyTitle}`;
      }

      const desc = story.description || "";
      const hasAsA = desc.toLowerCase().startsWith("as a") ||
        desc.toLowerCase().includes(" as a ");
      const hasSoThat = desc.toLowerCase().includes("so that");

      if (!hasAsA || !hasSoThat) {
        const parts = (story.storyTitle || "").split(">");
        const epic = parts[0]?.trim() || "user";
        const feature = parts[1]?.trim() || "this feature";

        if (hasAsA && !hasSoThat) {
          story.description = `${desc.trim()} So that the ${feature.toLowerCase()} requirement is fulfilled`;
        } else if (!hasAsA && hasSoThat) {
          story.description = `As a user I need ${feature.toLowerCase()} ${desc.toLowerCase().includes("so that") ? desc : `So that ${desc}`}`;
        } else {
          story.description = `As a ${epic.toLowerCase().replace(/epic\s+\d+:/i, "").trim() || "user"} I need ${feature.toLowerCase()} So that ${desc || "the business requirement is fulfilled"}`;
        }
      }

      let acArray = story.acceptanceCriteria || [];

      if (!Array.isArray(acArray)) acArray = [];

      const feature = (story.storyTitle || "").split(">").pop()?.trim() || "feature";

      if (acArray.length === 0) {
        acArray = [
          {
            id: "AC 1",
            scenario: `Given the user navigates to ${feature.toLowerCase()} When the page loads Then all required elements are displayed correctly`,
          },
          {
            id: "AC 2",
            scenario: "Given the user performs the main action When the system processes it Then the expected result is shown successfully",
          },
          {
            id: "AC 3",
            scenario: "Given an error occurs When the user performs the action Then an appropriate error message is displayed",
          },
        ];
      } else if (acArray.length === 1) {
        acArray.push({
          id: "AC 2",
          scenario: `Given the user performs the main action on ${feature.toLowerCase()} When the system processes the request Then the expected result is returned and displayed correctly`,
        });
        acArray.push({
          id: "AC 3",
          scenario: "Given an invalid input or error condition When the user submits the form Then the system displays a clear error message and guides the user",
        });
      } else if (acArray.length === 2) {
        acArray.push({
          id: "AC 3",
          scenario: `Given an edge case or error condition for ${feature.toLowerCase()} When it occurs Then the system handles it gracefully and shows appropriate feedback`,
        });
      }

      story.acceptanceCriteria = acArray.map((ac, i) => ({
        id: `AC ${i + 1}`,
        scenario: typeof ac === "string" ? ac : ac.scenario || ac.then || "",
      })).filter((ac) => ac.scenario);

      return story;
    });

    const descOK = allStories.filter((s) =>
      s.description?.toLowerCase().includes("as a") &&
      s.description?.toLowerCase().includes("so that"),
    ).length;

    const acOK = allStories.filter((s) =>
      (s.acceptanceCriteria?.length || 0) >= 3,
    ).length;

    console.log("[document] Post-processing results:");
    console.log(`[document] Desc OK: ${descOK}/${allStories.length}`);
    console.log(`[document] AC >= 3: ${acOK}/${allStories.length}`);

    allStories.sort((a, b) => {
      const getEpicNum = (title) => {
        const epicMatch = title?.match(/Epic\s+(\d+)/i);
        if (epicMatch) return parseInt(epicMatch[1]);
        if (title?.includes("User Goals")) return 0;
        if (title?.includes("Product Vision")) return 0;
        return 999;
      };

      const epicA = getEpicNum(a.storyTitle);
      const epicB = getEpicNum(b.storyTitle);

      if (epicA !== epicB) return epicA - epicB;

      return (a.storyTitle || "").localeCompare(b.storyTitle || "");
    });

    console.log("[document] After sorting:");
    console.log("[document] First:", allStories[0]?.storyTitle);
    console.log("[document] Last:", allStories[allStories.length - 1]?.storyTitle);

    // ── Save document record (VALIDATION 4 — owner + org) ─────────────────────
    const savedDoc = await Document.create({
      organisationId,
      projectId: projectId || null,
      clientId: clientId || undefined,
      originalName: file.originalname,
      fileType: allowedTypes.includes(fileExt) ? fileExt : "txt",
      fileSize: file.size,
      status: "processed",
      storiesCreated: allStories.length,
      uploadedBy: userId,
      uploadedByName: req.user?.name || "Unknown",
    });

    // ── Save stories to Review Queue ──────────────────────────────────────────
    const createdStories = [];
    for (let i = 0; i < allStories.length; i++) {
      const storyData = allStories[i];

      try {
        const acFormatted = (storyData.acceptanceCriteria || []).map((ac, idx) => ({
          id: ac.id || `AC ${idx + 1}`,
          scenario: typeof ac === "string" ? ac : ac.scenario || "",
        }));

        const story = await Story.create({
          organisationId,
          projectId: projectId || null,
          clientId: clientId || undefined,
          title: storyData.storyTitle,
          storyTitle: storyData.storyTitle,
          description: storyData.description,
          descriptionStatement: storyData.description,
          type: storyData.type || "Story",
          priority: storyData.priority || "Medium",
          status: "pending-review",
          source: "document",
          sourceRef: savedDoc._id.toString(),
          sourceQuote: `From document: ${file.originalname}`,
          acceptanceCriteria: acFormatted.map((ac) => ac.scenario),
          acceptanceCriteriaFormatted: acFormatted,
          releaseNotes: storyData.releaseNotes || "",
          sprint: storyData.sprint || "Backlog",
          isAIGenerated: true,
          sequence: i + 1,
          createdAt: new Date(Date.now() + (i * 100)),
        });

        createdStories.push(story);

        console.log(`[document] Story ${i + 1}: ${story.storyTitle?.substring(0, 50)} | AC: ${acFormatted.length}`);
      } catch (storyError) {
        console.error("[document] Story create error:", storyError.message);
      }
    }

    console.log("[document] Created", createdStories.length, "stories in Review Queue");

    return res.json({
      success: true,
      message: "Document analyzed successfully",
      documentId: savedDoc._id,
      documentSummary,
      documentTitle,
      storiesCreated: createdStories.length,
      totalRequirements: allStories.length,
      chunksProcessed: chunks.length,
      stories: createdStories.map((s) => ({
        _id: s._id,
        storyTitle: s.storyTitle,
        type: s.type,
        priority: s.priority,
        acceptanceCriteria: s.acceptanceCriteria,
      })),
    });
  } catch (error) {
    console.error("[document] Upload error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ organisationId: getOrgId(req) })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ success: true, documents });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const docId = req.params.id;

    await Story.deleteMany({ sourceRef: docId });
    await Document.findByIdAndDelete(docId);

    res.json({
      success: true,
      message: "Document and all its stories deleted",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
