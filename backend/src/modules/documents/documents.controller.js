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

export const uploadDocument = async (req, res) => {
  try {
    const { projectId, clientId } = req.body;
    const file = req.file;
    const organisationId = getOrgId(req);

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    console.log("[document] Processing:", file.originalname, "size:", file.size, "bytes");

    let documentText = "";
    const filename = file.originalname.toLowerCase();

    if (filename.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      documentText = result.value;
      console.log("[document] Extracted docx text:", documentText.length, "chars");
    } else if (filename.endsWith(".pdf")) {
      const pdfParse = await import("pdf-parse");
      const result = await pdfParse.default(file.buffer);
      documentText = result.text;
      console.log("[document] Extracted pdf text:", documentText.length, "chars");
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        documentText += `Sheet: ${sheetName}\n`;
        documentText += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
      });
      console.log("[document] Extracted xlsx text:", documentText.length, "chars");
    } else if (filename.endsWith(".txt") || filename.endsWith(".csv")) {
      documentText = file.buffer.toString("utf-8");
      console.log("[document] Extracted text:", documentText.length, "chars");
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

    // Limit input so output has room to fit within max_tokens
    const inputText = documentText.length > 8000
      ? documentText.substring(0, 8000)
      : documentText;

    const prompt = `IMPORTANT: Return raw JSON only. Do NOT wrap in markdown code blocks. Do NOT use \`\`\`json or \`\`\`. Start your response with { and end with }

You are a Business Analyst. Analyze this document and extract the TOP 10 most important requirements only. Focus on core features. Keep each story concise. Total response must be under 4000 tokens.

Return ONLY this JSON structure:
{"documentSummary":"brief summary","documentTitle":"title","totalRequirements":5,"stories":[{"storyTitle":"Module > Feature","type":"Story","priority":"Medium","description":"As a user I need X So that Y","acceptanceCriteria":[{"id":"AC 1","scenario":"Given X When Y Then Z"},{"id":"AC 2","scenario":"Given X When Y Then Z"},{"id":"AC 3","scenario":"Given X When Y Then Z"}],"releaseNotes":"We introduced X to solve Y","sprint":"Current"}]}

RULES: No markdown. No code blocks. No explanation. Raw JSON only. Minimum 3 ACs per story. Given/When/Then format.

Document: ${file.originalname}${documentText.length > 8000 ? " (analyzing first section)" : ""}
Content:
${inputText}`;

    console.log("[document] Sending to Claude AI (haiku)... input chars:", inputText.length);

    const makeRequest = () => getClaudeClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    let aiResponse;
    try {
      aiResponse = await makeRequest();
    } catch (apiError) {
      if (apiError.status === 429) {
        console.log("[document] Rate limit hit — waiting 60s before retry...");
        await new Promise((resolve) => setTimeout(resolve, 60000));
        aiResponse = await makeRequest();
      } else {
        throw apiError;
      }
    }

    const responseText = aiResponse.content[0].text;
    console.log("[document] Response length:", responseText.length);
    console.log("[document] Raw AI response (first 500):", responseText.substring(0, 500));

    // Strip markdown fences if present
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith("```")) {
      const firstNewline = cleanJson.indexOf("\n");
      cleanJson = cleanJson.substring(firstNewline + 1);
    }
    if (cleanJson.endsWith("```")) {
      cleanJson = cleanJson.substring(0, cleanJson.lastIndexOf("```"));
    }
    cleanJson = cleanJson.trim();

    const jsonStart = cleanJson.indexOf("{");
    const jsonEnd = cleanJson.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("[document] No JSON braces found. Full response:", responseText.substring(0, 1000));
      return res.status(500).json({ success: false, message: "AI analysis failed — no JSON in response. Please try again." });
    }
    cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);

    let analysis;
    try {
      analysis = JSON.parse(cleanJson);
      if (!analysis.stories || !Array.isArray(analysis.stories)) {
        throw new Error("No stories array in response");
      }
      console.log("[document] Parsed successfully:", analysis.stories.length, "stories");
    } catch (e) {
      console.error("[document] Parse failed:", e.message);
      // Partial-parse fallback — try to salvage the stories array
      try {
        const match = cleanJson.match(/"stories"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
        if (match) {
          analysis = { stories: JSON.parse(match[1]), documentSummary: "Document analyzed", totalRequirements: 0 };
          console.log("[document] Used partial parse fallback:", analysis.stories.length, "stories");
        } else {
          throw new Error("Cannot extract stories from response");
        }
      } catch (e2) {
        console.error("[document] Full response:", responseText.substring(0, 1000));
        return res.status(500).json({ success: false, message: "AI JSON parse failed. Please try again.", debug: e.message });
      }
    }

    console.log("[document] AI found", analysis.stories?.length, "stories");

    const fileExt = filename.split(".").pop();
    const validTypes = ["docx", "xlsx", "pdf", "txt", "csv"];
    const savedDoc = await Document.create({
      organisationId,
      projectId: projectId || null,
      clientId: clientId || null,
      originalName: file.originalname,
      fileType: validTypes.includes(fileExt) ? fileExt : "txt",
      fileSize: file.size,
      status: "processed",
      storiesCreated: analysis.stories?.length || 0,
      uploadedBy: req.user?.userId ?? req.user?.id,
    });

    const createdStories = [];
    for (const storyData of analysis.stories || []) {
      try {
        const story = await Story.create({
          organisationId,
          projectId: projectId || null,
          clientId: clientId || null,
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
      documentTitle: analysis.documentTitle || file.originalname,
      documentSummary: analysis.documentSummary || "",
      totalRequirements: analysis.totalRequirements || createdStories.length,
      storiesCreated: createdStories.length,
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
