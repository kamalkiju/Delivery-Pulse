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
    const organisationId = getOrgId(req);

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
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
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type. Please upload .docx, .pdf, .xlsx, or .txt",
      });
    }

    if (!documentText || documentText.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Could not extract text from document. Please check the file.",
      });
    }

    console.log("[document] Total text length:", documentText.length);

    // ── Split into chunks ─────────────────────────────────────────────────────
    const CHUNK_SIZE = 4000;
    const chunks = [];
    for (let i = 0; i < documentText.length; i += CHUNK_SIZE) {
      chunks.push(documentText.substring(i, i + CHUNK_SIZE));
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

Return ONLY this JSON structure, nothing else:
{"stories":[{"storyTitle":"Epic > Feature","type":"Story","priority":"Medium","description":"As a user I need X So that Y","acceptanceCriteria":[{"id":"AC 1","scenario":"Given X When Y Then Z"},{"id":"AC 2","scenario":"Given X When Y Then Z"},{"id":"AC 3","scenario":"Given X When Y Then Z"}],"releaseNotes":"We introduced X","sprint":"Current"}]}

Extract every requirement. Return raw JSON only.

Section ${idx + 1}/${chunks.length}:
${chunk.substring(0, CHUNK_SIZE)}`;

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

    // ── Save document record ──────────────────────────────────────────────────
    const fileExt = filename.split(".").pop();
    const validTypes = ["docx", "xlsx", "pdf", "txt", "csv"];
    const savedDoc = await Document.create({
      organisationId,
      projectId: projectId || null,
      clientId: clientId || undefined,
      originalName: file.originalname,
      fileType: validTypes.includes(fileExt) ? fileExt : "txt",
      fileSize: file.size,
      status: "processed",
      storiesCreated: allStories.length,
      uploadedBy: req.user?.userId ?? req.user?.id,
    });

    // ── Save stories to Review Queue ──────────────────────────────────────────
    const createdStories = [];
    for (const storyData of allStories) {
      try {
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
          sourceQuote: `From: ${file.originalname}`,
          acceptanceCriteria: storyData.acceptanceCriteria?.map((ac) => ac.scenario || ac) || [],
          acceptanceCriteriaFormatted: storyData.acceptanceCriteria || [],
          releaseNotes: storyData.releaseNotes || "",
          sprint: storyData.sprint || "Backlog",
          isAIGenerated: true,
        });
        createdStories.push(story);
      } catch (storyErr) {
        console.error("[document] Story create error:", storyErr.message);
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
