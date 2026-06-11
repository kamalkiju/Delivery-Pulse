import Anthropic from "@anthropic-ai/sdk";
import Story from "../../models/Story.model.js";
import Document from "../../models/Document.model.js";

const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
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

    const maxChars = 80000;
    const truncatedText =
      documentText.length > maxChars
        ? documentText.substring(0, maxChars) + "\n\n[Document truncated — first 80000 characters analyzed]"
        : documentText;

    const prompt = `You are a senior Business Analyst and Product Manager.
Analyze this product requirement document thoroughly and completely.

Your task:
- Read EVERY section, EVERY page, EVERY requirement
- Extract ALL user stories, features, bugs, tasks, and requirements
- Create properly structured ADO stories for each requirement
- Be thorough — do not skip any requirement

Return ONLY valid JSON in this EXACT format:
{
  "documentTitle": "The title or name of this document",
  "documentSummary": "Brief 2-3 sentence summary of the entire document",
  "totalRequirements": 10,
  "stories": [
    {
      "storyTitle": "ProjectName > Module > Specific Feature Name",
      "type": "Story or Bug or Feature or Task",
      "priority": "Critical or High or Medium or Low",
      "description": "As a [specific user type] I need [specific capability] So that [specific business value and measurable outcome]",
      "acceptanceCriteria": [
        { "id": "AC 1", "scenario": "Given [initial context] When [action is performed] Then [expected outcome]" },
        { "id": "AC 2", "scenario": "Given [initial context] When [action is performed] Then [expected outcome]" },
        { "id": "AC 3", "scenario": "Given [initial context] When [action is performed] Then [expected outcome]" }
      ],
      "releaseNotes": "We introduced [feature name] to [solve specific problem]. This was developed to meet [specific requirement]. [Business impact statement].",
      "sprint": "Current or Next or Backlog"
    }
  ]
}

STRICT RULES:
1. Extract EVERY SINGLE requirement as a separate story
2. NEVER use raw text as story title — create meaningful titles
3. ALWAYS write description as "As a X I need Y So that Z"
4. ALWAYS create minimum 3 acceptance criteria per story
5. ALWAYS use Given/When/Then format for ALL criteria
6. Priority rules:
   - Critical: system broken, security issue, data loss, show stopper
   - High: core feature, blocks users, business critical
   - Medium: important feature, enhancement
   - Low: nice to have, minor improvement
7. Type rules:
   - Bug: fix, error, broken, not working, issue
   - Feature: new capability, add, introduce
   - Story: user requirement, need to, should be able to
   - Task: update, configure, setup, migrate

Document filename: ${file.originalname}
Document content:
${truncatedText}

Return ONLY valid JSON. No markdown. No code blocks. Just JSON.`;

    console.log("[document] Sending to Claude AI...");

    const response = await claude.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].text;
    const clean = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(clean);
    } catch (parseError) {
      console.error("[document] JSON parse error:", parseError.message);
      console.error("[document] Raw response:", responseText.substring(0, 500));
      return res.status(500).json({
        success: false,
        message: "AI could not parse the document. Please try again.",
      });
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
