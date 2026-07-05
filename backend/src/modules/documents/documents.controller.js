import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
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

const fixStoryTitle = (title, structure) => {
  if (!title) return "General > Feature";

  if (title.includes(">")) return title;

  if (structure?.epics) {
    const titleLower = title.toLowerCase();
    for (const epic of structure.epics) {
      const epicNameLower = epic.name.toLowerCase();
      const epicWords = epicNameLower.split(" ").filter((w) => w.length > 3);

      if (epicWords.some((word) => titleLower.includes(word))) {
        return `${epic.name} > ${title}`;
      }
    }
  }

  if (title.includes(":")) {
    return title.replace(/:\s*/, " > ");
  }

  return `General > ${title}`;
};

const extractText = async (buffer, fileType, originalName, mimetype) => {
  try {
    const type = (fileType || "").toLowerCase();

    if (
      type === "docx" ||
      type === "doc" ||
      originalName?.endsWith(".docx") ||
      mimetype?.includes("wordprocessingml") ||
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      try {
        const rawResult = await mammoth.extractRawText({ buffer });
        let text = rawResult.value || "";

        console.log("[document] Raw text length:", text.length);

        if (text.length < 500) {
          const htmlResult = await mammoth.convertToHtml({ buffer });
          const htmlText = htmlResult.value
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          console.log("[document] HTML text length:", htmlText.length);
          if (htmlText.length > text.length) {
            text = htmlText;
          }
        }

        console.log("[document] Final extracted text length:", text.length);
        return text;
      } catch (err) {
        console.error("[document] Mammoth error:", err.message);
        return "";
      }
    }

    if (
      type === "pdf" ||
      type === "application/pdf" ||
      (buffer[0] === 0x25 && buffer[1] === 0x50)
    ) {
      try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParseFn = pdfParseModule.default ||
          pdfParseModule.PDFParse ||
          Object.values(pdfParseModule)[0];

        if (pdfParseModule.PDFParse) {
          const parser = new pdfParseModule.PDFParse({ data: buffer });
          const result = await parser.getText();
          return result.text || "";
        }

        const result = await pdfParseFn(buffer);
        return result.text || "";
      } catch (err) {
        console.error("[document] PDF parse error:", err.message);
        return "";
      }
    }

    if (type === "xlsx" || type === "xls") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let text = "";
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        text += `Sheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
      });
      return text;
    }

    if (type === "txt" || type === "text/plain" || type === "csv") {
      return buffer.toString("utf8");
    }

    return buffer.toString("utf8");
  } catch (error) {
    console.error("[document] Text extraction error:", error.message);
    return "";
  }
};

export const uploadDocument = async (req, res) => {
  let savedDoc;
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

    const fileBuffer = file.buffer;
    const fileType = file.mimetype ||
      file.originalname.split(".").pop()?.toLowerCase();

    console.log("[document] Extracting text from buffer...");
    const extractedText = await extractText(
      fileBuffer,
      fileType,
      file.originalname,
      file.mimetype,
    );
    console.log("[document] Extracted text length:", extractedText.length);

    if (!extractedText || extractedText.length < 100) {
      console.error("[document] Text extraction failed or too short");
      return res.status(400).json({
        success: false,
        message: "Could not extract text from document. Please check the file.",
      });
    }

    const documentText = extractedText;

    console.log("[document] Total text length:", documentText.length);

    // Save document record early with extracted text (no disk file on Render)
    savedDoc = await Document.create({
      organisationId,
      projectId: projectId || null,
      clientId: clientId || undefined,
      originalName: file.originalname,
      fileType: allowedTypes.includes(fileExt) ? fileExt : "txt",
      filePath: "",
      fileSize: file.size,
      extractedText: documentText,
      textLength: documentText.length,
      status: "processing",
      processingProgress: 0,
      uploadedBy: userId,
      uploadedByName: req.user?.name || "Unknown",
    });

    console.log("[document] Saved document record:", savedDoc._id);

    // ── Split into chunks (with overlap to avoid missing stories at boundaries) ─
    const CHUNK_SIZE = 3000;
    const OVERLAP = 200;

    let chunks = [];
    if (documentText.length <= CHUNK_SIZE + OVERLAP) {
      chunks = [documentText];
      console.log("[document] Small document - processing as single chunk");
    } else {
      for (let i = 0; i < documentText.length; i += CHUNK_SIZE - OVERLAP) {
        chunks.push(documentText.slice(i, i + CHUNK_SIZE));
      }
    }
    console.log("[document] Processing", chunks.length, "chunk(s)");

    const claude = getClaudeClient();
    let allStories = [];
    let documentSummary = "";
    let documentTitle = file.originalname;
    let documentStructure = null;

    // ── Step 1: Detect document structure ─────────────────────────────────────
    const structurePrompt = `Analyze this document and identify its structure.
Return ONLY this JSON:
{
  "documentTitle": "title of document",
  "documentSummary": "2-3 sentence summary",
  "epics": [
    {
      "number": 1,
      "name": "Epic name from document",
      "description": "what this epic covers"
    }
  ],
  "totalEstimatedStories": 10
}

If document does not use epic structure use sections or modules instead.
If no clear structure found create logical groupings.

Document (first 5000 chars):
${documentText.substring(0, 5000)}`;

    try {
      const structureResponse = await claude.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: structurePrompt }],
      });

      const structureText = structureResponse.content[0].text;
      const cleanStructure = structureText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      const jsonStart = cleanStructure.indexOf("{");
      const jsonEnd = cleanStructure.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        documentStructure = JSON.parse(cleanStructure.substring(jsonStart, jsonEnd + 1));
        console.log("[document] Structure detected:",
          documentStructure.epics?.length, "sections");
        console.log("[document] Epics:",
          documentStructure.epics?.map((e) => e.name).join(", "));

        if (documentStructure.documentTitle) {
          documentTitle = documentStructure.documentTitle;
        }
        if (documentStructure.documentSummary) {
          documentSummary = documentStructure.documentSummary;
        }
      }
    } catch (structureError) {
      console.log("[document] Structure detection failed, using generic approach:",
        structureError.message);
    }

    const epicsContext = documentStructure?.epics
      ? `Document structure has these sections:
${documentStructure.epics.map((e) => `- ${e.name}: ${e.description}`).join("\n")}`
      : "Use the document headings as epic/section names.";

    // ── Step 2: Process each chunk with structure context ─────────────────────
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const isLast = chunkIndex === chunks.length - 1;

      console.log(`[document] Processing chunk ${chunkIndex + 1}/${chunks.length}`);

      const prompt = `You are a senior Business Analyst.
Extract ALL user stories from this document section.

This may be an amendments document describing changes
to existing features. Extract each change or update
as a separate user story.

${epicsContext}

STRICT RULES:
1. storyTitle format: "[Section/Epic Name] > [Feature Name]"
   Use the ACTUAL section names from the document
   NOT generic names

2. description MUST start with "As a" and include "So that"
   Format: "As a [user role] I need [feature] So that [value]"

3. Every story needs MINIMUM 3 acceptance criteria
   Format: "Given [context] When [action] Then [result]"

4. Extract EVERY requirement as separate story
   Count every "As a user" or feature description

5. If document has no clear user stories
   Convert every requirement into user story format

Return ONLY raw JSON - no markdown:
{
  "stories": [
    {
      "storyTitle": "Section Name > Feature Name",
      "type": "Story or Bug or Feature or Task",
      "priority": "Critical or High or Medium or Low",
      "description": "As a [role] I need [what] So that [value]",
      "acceptanceCriteria": [
        {"id": "AC 1", "scenario": "Given X When Y Then Z"},
        {"id": "AC 2", "scenario": "Given X When Y Then Z"},
        {"id": "AC 3", "scenario": "Given X When Y Then Z"}
      ],
      "releaseNotes": "We introduced [feature] to [solve problem]",
      "sprint": "Current or Next or Backlog"
    }
  ]
}

Document section ${chunkIndex + 1} of ${chunks.length}:
${chunk}`;

      let attempt = 0;
      while (attempt < 2) {
        try {
          const response = await claude.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 3000,
            messages: [{ role: "user", content: prompt }],
          });

          const chunkAnalysis = parseChunkResponse(response.content[0].text);

          if (!chunkAnalysis?.stories?.length) {
            console.log(`[document] Chunk ${chunkIndex + 1} — no stories found`);
            break;
          }

          allStories = allStories.concat(chunkAnalysis.stories);
          console.log(`[document] Chunk ${chunkIndex + 1} → ${chunkAnalysis.stories.length} stories. Total: ${allStories.length}`);
          break;

        } catch (err) {
          if (err.status === 429) {
            console.log(`[document] Rate limit on chunk ${chunkIndex + 1} — waiting 30s...`);
            await sleep(30000);
            attempt++;
          } else {
            console.error(`[document] Chunk ${chunkIndex + 1} error:`, err.message);
            break;
          }
        }
      }

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
        story.storyTitle = fixStoryTitle(story.storyTitle, documentStructure);
        story.title = story.storyTitle;
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
      const getOrder = (title) => {
        const epicMatch = title?.match(/Epic\s+(\d+)/i);
        if (epicMatch) return parseInt(epicMatch[1]);

        if (documentStructure?.epics) {
          const epicIndex = documentStructure.epics.findIndex((e) =>
            title?.toLowerCase().includes(e.name.toLowerCase().split(" ")[0]),
          );
          if (epicIndex !== -1) return epicIndex;
        }

        return 999;
      };

      const orderA = getOrder(a.storyTitle);
      const orderB = getOrder(b.storyTitle);

      if (orderA !== orderB) return orderA - orderB;

      return (a.storyTitle || "").localeCompare(b.storyTitle || "");
    });

    console.log("[document] After sorting:");
    console.log("[document] First:", allStories[0]?.storyTitle);
    console.log("[document] Last:", allStories[allStories.length - 1]?.storyTitle);

    // ── Update document record after processing ───────────────────────────────
    savedDoc.status = "processed";
    savedDoc.storiesCreated = allStories.length;
    savedDoc.processingProgress = 100;
    await savedDoc.save();

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

    if (savedDoc?._id) {
      try {
        savedDoc.status = "failed";
        await savedDoc.save();
      } catch {
        // ignore secondary save failure
      }
    }

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
