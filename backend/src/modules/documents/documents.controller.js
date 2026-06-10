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

    console.log("[document] Processing:", file.originalname, "size:", file.size);

    let documentText = "";
    const filename = file.originalname.toLowerCase();

    if (filename.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      documentText = result.value;
    } else if (filename.endsWith(".pdf")) {
      const pdfParse = await import("pdf-parse");
      const result = await pdfParse.default(file.buffer);
      documentText = result.text;
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        documentText += XLSX.utils.sheet_to_csv(sheet) + "\n";
      });
    } else {
      documentText = file.buffer.toString("utf-8");
    }

    console.log("[document] Extracted text length:", documentText.length);

    const maxChars = 50000;
    const truncatedText =
      documentText.length > maxChars
        ? documentText.substring(0, maxChars) + "\n[Document truncated for analysis]"
        : documentText;

    const prompt = `You are a senior Business Analyst. Analyze this product requirement document thoroughly.
Extract ALL user stories, features, requirements, and bugs mentioned.

For each requirement create a properly structured story.
Be thorough - analyze every section, every page, every requirement.

Return ONLY valid JSON in this exact format:
{
  "documentSummary": "Brief summary of the document",
  "totalStoriesFound": 10,
  "stories": [
    {
      "storyTitle": "ProjectName > Module > Feature Name",
      "type": "Story or Bug or Feature or Task",
      "priority": "Critical or High or Medium or Low",
      "description": "As a [specific user type] I need [specific capability] So that [specific business value]",
      "acceptanceCriteria": [
        { "id": "AC 1", "scenario": "Given [context] When [action] Then [expected result]" },
        { "id": "AC 2", "scenario": "Given [context] When [action] Then [expected result]" },
        { "id": "AC 3", "scenario": "Given [context] When [action] Then [expected result]" }
      ],
      "releaseNotes": "We introduced [feature] to [solve problem]. This meets [requirement].",
      "sprint": "Current or Next or Backlog"
    }
  ]
}

Rules:
- Extract EVERY requirement as a separate story
- Minimum 3 acceptance criteria per story
- Use Given/When/Then format for ALL criteria
- Make descriptions follow "As a X I need Y So that Z" format
- Infer missing details from context
- Do NOT skip any requirement

Document filename: ${file.originalname}
Document content:
${truncatedText}

Return ONLY the JSON object. No markdown. No explanation.`;

    console.log("[document] Sending to Claude AI for analysis...");

    const response = await claude.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].text;
    const clean = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(clean);

    console.log("[document] AI found", analysis.stories?.length, "stories");

    const fileExt = filename.split(".").pop();
    const savedDoc = await Document.create({
      organisationId,
      projectId: projectId || null,
      clientId: clientId || null,
      originalName: file.originalname,
      fileType: ["docx", "xlsx", "pdf"].includes(fileExt) ? fileExt : "docx",
      fileSize: file.size,
      status: "processed",
      storiesCreated: analysis.stories?.length || 0,
      uploadedBy: req.user?.userId ?? req.user?.id,
    });

    const createdStories = [];
    for (const storyData of analysis.stories || []) {
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
        acceptanceCriteria: storyData.acceptanceCriteria?.map((ac) => ac.scenario) || [],
        acceptanceCriteriaFormatted: storyData.acceptanceCriteria || [],
        releaseNotes: storyData.releaseNotes || "",
        sprint: storyData.sprint || "Backlog",
        isAIGenerated: true,
      });
      createdStories.push(story);
    }

    return res.json({
      success: true,
      message: "Document analyzed successfully",
      documentId: savedDoc._id,
      documentSummary: analysis.documentSummary,
      storiesCreated: createdStories.length,
      stories: createdStories,
    });
  } catch (error) {
    console.error("[document] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ organisationId: getOrgId(req) })
      .sort({ createdAt: -1 });
    return res.json({ success: true, documents });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
