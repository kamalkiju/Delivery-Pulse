import { useEffect, useState, type CSSProperties } from "react";
import AppShell from "../../components/layout/AppShell";
import api from "../../api/axios";

// ── Types ────────────────────────────────────────────────────────────────────

interface AcItem {
  id?: string;
  scenario?: string;
  given?: string;
  when?: string;
  then?: string;
}

interface Story {
  _id?: string;
  id?: string;
  ticketId?: string;
  storyTitle?: string;
  title: string;
  type: string;
  priority: string;
  source?: string;
  description?: string;
  sourceQuote?: string;
  acceptanceCriteria?: (string | AcItem)[];
  acceptanceCriteriaFormatted?: AcItem[];
  releaseNotes?: string;
  sprint?: string;
  assignee?: string;
  areaPath?: string;
  tags?: string[];
  figmaLink?: string;
  userFlow?: string;
  uiBehavior?: string;
  businessRequirement?: string;
  validations?: string[];
  adoId?: string;
  approvedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  timeAgo?: string;
  client?: string;
  clientId?: { _id?: string; name: string; company?: string } | string | null;
  projectId?: { name: string; color?: string } | null;
  isAIGenerated?: boolean;
  regressionWarning?: string;
  sequence?: number;
}

interface EditForm {
  storyTitle: string;
  type: string;
  priority: string;
  description: string;
  acceptanceCriteria: { id: string; scenario: string }[];
  releaseNotes: string;
  sprint: string;
  assignee: string;
  areaPath: string;
  tags: string[];
  figmaLink: string;
  userFlow: string;
  uiBehavior: string;
  validations: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sid = (s: Story): string => s._id ?? s.id ?? "";

const acText = (ac: string | AcItem): string => {
  if (typeof ac === "string") return ac;
  return ac.scenario ?? ac.then ?? [ac.given, ac.when, ac.then].filter(Boolean).join(" ") ?? "";
};

const acId = (ac: string | AcItem, i: number): string => {
  if (typeof ac === "string") return `AC ${i + 1}`;
  return ac.id ?? `AC ${i + 1}`;
};

function parseStories(data: unknown): Story[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const arr = (Array.isArray(d.data) ? d.data : null)
    ?? (Array.isArray(d.stories) ? d.stories : null)
    ?? [];
  return arr as Story[];
}

function sortDocumentStories(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => {
    if (a.sequence != null && b.sequence != null) return a.sequence - b.sequence;
    if (a.sequence != null) return -1;
    if (b.sequence != null) return 1;

    const titleA = a.storyTitle || a.title || "";
    const titleB = b.storyTitle || b.title || "";
    const epicA = titleA.match(/Epic\s+(\d+)/i);
    const epicB = titleB.match(/Epic\s+(\d+)/i);
    if (epicA && epicB) return parseInt(epicA[1]) - parseInt(epicB[1]);

    return titleA.localeCompare(titleB);
  });
}

// ── Colour maps ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Bug:     { bg: "#fef2f2", text: "#dc2626", border: "#dc2626" },
  Story:   { bg: "#eff6ff", text: "#2563eb", border: "#2563eb" },
  Feature: { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  Task:    { bg: "#fffbeb", text: "#d97706", border: "#d97706" },
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#dc2626", High: "#ea580c", Medium: "#d97706", Low: "#16a34a",
};

const fallbackColor = TYPE_COLORS.Story;

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  display: "block",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

interface StoryCardProps {
  story: Story;
  tabSource: string;
  deletingId: string | null;
  onEdit: (story: Story) => void;
  onReject: (storyId: string) => void;
  onApprove: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
}

function StoryCard({ story, tabSource, deletingId, onEdit, onReject, onApprove, onDelete }: StoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const storyId = sid(story);
  const colors = TYPE_COLORS[story.type] ?? fallbackColor;
  const priorityColor = PRIORITY_COLORS[story.priority] ?? "#94a3b8";
  const acList = story.acceptanceCriteriaFormatted?.length
    ? story.acceptanceCriteriaFormatted
    : (story.acceptanceCriteria ?? []);

  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: 12,
      border: "1px solid #e2e8f0",
      marginBottom: 16,
      borderLeft: `4px solid ${colors.border}`,
      overflow: "hidden",
    }}>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ backgroundColor: colors.bg, color: colors.text, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
            {story.type || "Story"}
          </span>
          <span style={{ backgroundColor: "#f1f5f9", color: "#64748b", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500 }}>
            {story.ticketId || `DP-${storyId.slice(-4).toUpperCase()}`}
          </span>
          <span style={{ backgroundColor: priorityColor + "20", color: priorityColor, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
            {story.priority || "Medium"}
          </span>
          {story.isAIGenerated && (
            <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: 999, fontSize: 12 }}>✨ AI Generated</span>
          )}
          {story.sprint && (
            <span style={{ backgroundColor: "#faf5ff", color: "#7c3aed", padding: "3px 10px", borderRadius: 999, fontSize: 12 }}>📅 {story.sprint}</span>
          )}
          {tabSource === "slack" && (
            <span style={{ backgroundColor: "#f8f0ff", color: "#7c3aed", padding: "3px 10px", borderRadius: 999, fontSize: 12, border: "1px solid #e9d5ff" }}>💬 Slack</span>
          )}
          {tabSource === "document" && (
            <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", padding: "3px 10px", borderRadius: 999, fontSize: 12, border: "1px solid #fed7aa" }}>📄 Document</span>
          )}
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 4px", lineHeight: 1.4 }}>
          {story.storyTitle || story.title}
        </h3>

        {story.areaPath && (
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 12px", fontFamily: "monospace" }}>📂 {story.areaPath}</p>
        )}

        {story.description && (
          <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: "#334155", margin: 0, lineHeight: 1.7, fontStyle: "italic" }}>{story.description}</p>
          </div>
        )}

        {story.sourceQuote && tabSource === "slack" && (
          <div style={{ backgroundColor: "#f8fafc", borderLeft: "3px solid #7c3aed", padding: "8px 12px", borderRadius: "0 6px 6px 0", marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", margin: 0 }}>💬 Client said: &quot;{story.sourceQuote}&quot;</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ background: "none", border: "none", color: "#0088ff", fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, marginBottom: isExpanded ? 12 : 0 }}
        >
          {isExpanded ? "▼" : "▶"} {isExpanded ? "Hide details" : "View full ADO details"}
        </button>

        {isExpanded && (
          <div>
            {story.businessRequirement && (
              <div style={{ backgroundColor: "#eff6ff", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>📋 Business Requirement</p>
                <p style={{ fontSize: 13, color: "#1e3a5f", margin: 0, lineHeight: 1.6 }}>{story.businessRequirement}</p>
              </div>
            )}
            {story.userFlow && (
              <div style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>👤 User Flow</p>
                <p style={{ fontSize: 13, color: "#14532d", margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>{story.userFlow}</p>
              </div>
            )}
            {story.uiBehavior && (
              <div style={{ backgroundColor: "#faf5ff", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#6b21a8", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>🖥️ UI Behavior</p>
                <p style={{ fontSize: 13, color: "#3b0764", margin: 0, lineHeight: 1.6 }}>{story.uiBehavior}</p>
              </div>
            )}
            {(story.validations?.length ?? 0) > 0 && (
              <div style={{ backgroundColor: "#fffbeb", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>✅ Validations</p>
                {story.validations!.map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 13, color: "#78350f" }}>
                    <span style={{ flexShrink: 0 }}>•</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ backgroundColor: "#f8fafc", borderRadius: 8, padding: "12px 14px", marginBottom: 10, border: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                🎯 Acceptance Criteria ({acList.length})
              </p>
              {acList.map((ac, i) => (
                <div key={i} style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 12px", marginBottom: 8, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700, color: "#0088ff", marginRight: 8, fontSize: 12 }}>{acId(ac, i)}</span>
                  {acText(ac)}
                </div>
              ))}
            </div>
            {story.releaseNotes && (
              <div style={{ backgroundColor: "#f0fdf4", borderRadius: 8, padding: "12px 14px", marginBottom: 10, border: "1px solid #bbf7d0" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>📝 Release Notes</p>
                <p style={{ fontSize: 13, color: "#14532d", margin: 0, lineHeight: 1.6 }}>{story.releaseNotes}</p>
              </div>
            )}
            {story.sourceQuote && tabSource === "document" && (
              <div style={{ backgroundColor: "#fff7ed", borderLeft: "3px solid #f97316", padding: "8px 12px", borderRadius: "0 6px 6px 0", marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: "#9a3412", fontStyle: "italic", margin: 0 }}>📄 {story.sourceQuote}</p>
              </div>
            )}
          </div>
        )}

        {(story.tags?.length ?? 0) > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {story.tags!.map((tag, i) => (
              <span key={i} style={{ backgroundColor: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 4, fontSize: 11, border: "1px solid #e2e8f0", fontFamily: "monospace" }}>#{tag}</span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#94a3b8", alignItems: "center" }}>
            {story.assignee ? <span>👤 {story.assignee}</span> : <span style={{ color: "#e2e8f0" }}>👤 Unassigned</span>}
            {typeof story.clientId === "object" && story.clientId?.name && <span>🏢 {story.clientId.name}</span>}
            <span>🕐 {story.timeAgo || new Date(story.createdAt ?? Date.now()).toLocaleDateString()}</span>
            {story.regressionWarning && <span style={{ color: "#f59e0b" }}>⚠ {story.regressionWarning}</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => onEdit(story)} style={{ padding: "7px 16px", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Edit</button>
            {tabSource === "document" && onDelete && (
              <button type="button" onClick={() => onDelete(storyId)} disabled={deletingId === storyId} style={{ padding: "7px 12px", backgroundColor: "white", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 7, cursor: deletingId === storyId ? "not-allowed" : "pointer", fontSize: 13 }}>
                {deletingId === storyId ? "..." : "🗑️"}
              </button>
            )}
            <button type="button" onClick={() => onReject(storyId)} style={{ padding: "7px 16px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Reject</button>
            <button type="button" onClick={() => onApprove(storyId)} style={{ padding: "7px 16px", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✓ Approve</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, buttonText, buttonAction }: {
  icon: string; title: string; subtitle: string;
  buttonText?: string; buttonAction?: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500, margin: "0 0 8px" }}>{title}</p>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>{subtitle}</p>
      {buttonText && buttonAction && (
        <button type="button" onClick={buttonAction} style={{ backgroundColor: "#0088ff", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>
          {buttonText}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ReviewQueuePage = () => {
  const [activeTab, setActiveTab]             = useState("slack");
  const [slackStories, setSlackStories]       = useState<Story[]>([]);
  const [documentStories, setDocumentStories] = useState<Story[]>([]);
  const [adoStories, setAdoStories]           = useState<Story[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [editingStory, setEditingStory]       = useState<Story | null>(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editForm, setEditForm]               = useState<EditForm>({
    storyTitle: "",
    type: "Story",
    priority: "Medium",
    description: "",
    acceptanceCriteria: [],
    releaseNotes: "",
    sprint: "Current",
    assignee: "",
    areaPath: "",
    tags: [],
    figmaLink: "",
    userFlow: "",
    uiBehavior: "",
    validations: [],
  });
  const [deletingId, setDeletingId]           = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAllStories = async () => {
    setIsLoading(true);
    setError(null);
    const pp = localStorage.getItem("activeProjectId") ? `&projectId=${localStorage.getItem("activeProjectId")}` : "";

    try {
      // Fetch Slack stories
      const slackRes = await api.get(`/review?source=slack${pp}`);
      console.log("[ReviewQueue] slack response:", slackRes.data);
      const slackData = parseStories(slackRes.data);
      console.log("[ReviewQueue] slack stories count:", slackData.length);
      setSlackStories(slackData);
    } catch (e: unknown) {
      console.error("[ReviewQueue] slack fetch failed:", e);
      setSlackStories([]);
    }

    try {
      // Fetch Document stories
      const docRes = await api.get(`/review?source=document${pp}`);
      const d = docRes.data as Record<string, unknown>;
      const docStories = (Array.isArray(d.data) ? d.data : null)
        ?? (Array.isArray(d.stories) ? d.stories : null)
        ?? [];
      setDocumentStories(sortDocumentStories(docStories as Story[]));
    } catch {
      setDocumentStories([]);
    }

    try {
      // Fetch ADO (approved) stories
      const adoRes = await api.get(`/stories?status=approved${pp}`);
      const adoData = parseStories(adoRes.data) as Story[];
      setAdoStories(adoData);
    } catch {
      setAdoStories([]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllStories();
    const iv = setInterval(fetchAllStories, 20_000);
    window.addEventListener("project-changed", fetchAllStories);
    return () => {
      clearInterval(iv);
      window.removeEventListener("project-changed", fetchAllStories);
    };
  }, []);

  useEffect(() => {
    console.log("[ReviewQueue] slackStories updated:", slackStories.length);
  }, [slackStories]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApprove = async (storyId: string) => {
    try {
      await api.patch(`/stories/${storyId}/approve`);
      fetchAllStories();
    } catch {
      alert("Failed to approve story");
    }
  };

  const handleReject = async (storyId: string) => {
    try {
      await api.patch(`/stories/${storyId}/reject`);
      fetchAllStories();
    } catch {
      alert("Failed to reject story");
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm("Delete this story?")) return;
    try {
      setDeletingId(storyId);
      await api.delete(`/stories/${storyId}`);
      fetchAllStories();
    } catch {
      alert("Failed to delete story");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllDocumentStories = async () => {
    if (!window.confirm("Delete ALL document stories? This cannot be undone.")) return;
    try {
      await api.delete("/stories/delete-by-source/document");
      fetchAllStories();
      alert("All document stories deleted");
    } catch {
      alert("Failed to delete stories");
    }
  };

  const handleEditClick = (story: Story) => {
    setEditingStory(story);
    const acs = (story.acceptanceCriteriaFormatted?.length
      ? story.acceptanceCriteriaFormatted
      : (story.acceptanceCriteria ?? [])
    ).map((ac, i) => ({
      id: acId(ac, i),
      scenario: acText(ac),
    }));
    setEditForm({
      storyTitle: story.storyTitle ?? story.title ?? "",
      type: story.type ?? "Story",
      priority: story.priority ?? "Medium",
      description: story.description ?? "",
      acceptanceCriteria: acs,
      releaseNotes: story.releaseNotes ?? "",
      sprint: story.sprint ?? "Current",
      assignee: story.assignee ?? "",
      areaPath: story.areaPath ?? "",
      tags: story.tags ?? [],
      figmaLink: story.figmaLink ?? "",
      userFlow: story.userFlow ?? "",
      uiBehavior: story.uiBehavior ?? "",
      validations: story.validations ?? [],
    });
    setIsEditPanelOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStory) return;
    try {
      await api.patch(`/stories/${sid(editingStory)}`, {
        title: editForm.storyTitle,
        storyTitle: editForm.storyTitle,
        type: editForm.type,
        priority: editForm.priority,
        description: editForm.description,
        acceptanceCriteria: editForm.acceptanceCriteria.map((ac) => ac.scenario),
        acceptanceCriteriaFormatted: editForm.acceptanceCriteria,
        releaseNotes: editForm.releaseNotes,
        sprint: editForm.sprint,
        assignee: editForm.assignee,
        areaPath: editForm.areaPath,
        tags: editForm.tags,
        figmaLink: editForm.figmaLink,
        userFlow: editForm.userFlow,
        uiBehavior: editForm.uiBehavior,
        validations: editForm.validations,
      });
      setIsEditPanelOpen(false);
      fetchAllStories();
    } catch {
      alert("Failed to save story");
    }
  };

  const renderStoryCard = (story: Story, tabSource: string) => (
    <StoryCard
      key={sid(story)}
      story={story}
      tabSource={tabSource}
      deletingId={deletingId}
      onEdit={handleEditClick}
      onReject={handleReject}
      onApprove={handleApprove}
      onDelete={tabSource === "document" ? handleDeleteStory : undefined}
    />
  );

  // ── ADO card ───────────────────────────────────────────────────────────────

  const renderAdoCard = (story: Story) => (
    <div key={sid(story)} style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", borderLeft: "4px solid #16a34a", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>✅ Approved</span>
        {story.adoId && <span style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>ADO #{story.adoId}</span>}
        <span style={{ backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 10px", borderRadius: 999, fontSize: 12 }}>{story.type}</span>
        <span style={{ backgroundColor: (PRIORITY_COLORS[story.priority] ?? "#94a3b8") + "20", color: PRIORITY_COLORS[story.priority] ?? "#94a3b8", padding: "2px 10px", borderRadius: 999, fontSize: 12 }}>{story.priority}</span>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>{story.storyTitle ?? story.title}</h3>
      {story.description && <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>{story.description}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          Approved {new Date(story.approvedAt ?? story.updatedAt ?? Date.now()).toLocaleDateString()}
        </span>
      </div>
    </div>
  );

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs = [
    { key: "slack",    label: "Slack Messages", count: slackStories.length,    icon: "💬" },
    { key: "document", label: "Documents",       count: documentStories.length, icon: "📄" },
    { key: "ado",      label: "ADO Stories",     count: adoStories.length,      icon: "✅" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell pageTitle="Review Queue">
      <div style={{ margin: "-24px", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 60px)" }}>

        {/* Header */}
        <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", flexShrink: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>Review Queue</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 8px" }}>
            Review and approve AI-generated stories before pushing to ADO
          </p>
          <div style={{ display: "flex", gap: 24 }}>
            <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>
              ⏳ {slackStories.length + documentStories.length} Pending
            </span>
            <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 500 }}>
              ✅ {adoStories.length} Approved
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", padding: "0 24px", flexShrink: 0 }}>
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={{
              padding: "14px 20px", fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: "pointer", border: "none",
              borderBottom: activeTab === tab.key ? "2px solid #0088ff" : "2px solid transparent",
              color: activeTab === tab.key ? "#0088ff" : "#64748b",
              backgroundColor: "transparent",
              display: "flex", alignItems: "center", gap: 8, marginBottom: -1,
            }}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{ backgroundColor: activeTab === tab.key ? "#eff6ff" : "#f1f5f9", color: activeTab === tab.key ? "#0088ff" : "#64748b", borderRadius: 999, padding: "1px 8px", fontSize: 12, fontWeight: 600 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>Loading stories…
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: 40, color: "#dc2626" }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>⚠ {error}</p>
              <button type="button" onClick={fetchAllStories} style={{ marginTop: 12, padding: "8px 20px", backgroundColor: "#0088ff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {activeTab === "slack" && (
                slackStories.length === 0
                  ? <EmptyState icon="💬" title="No Slack stories pending review" subtitle="Stories appear here when clients send messages in monitored Slack channels" />
                  : slackStories.map((s) => renderStoryCard(s, "slack"))
              )}
              {activeTab === "document" && (
                documentStories.length === 0
                  ? <EmptyState icon="📄" title="No document stories pending review" subtitle="Upload a PRD or UAT document to generate stories automatically" buttonText="Upload Document" buttonAction={() => { window.location.href = "/documents"; }} />
                  : (
                    <>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                        <button
                          type="button"
                          onClick={handleDeleteAllDocumentStories}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#dc2626",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          🗑️ Delete All Document Stories
                        </button>
                      </div>
                      {documentStories.map((s) => renderStoryCard(s, "document"))}
                    </>
                  )
              )}
              {activeTab === "ado" && (
                adoStories.length === 0
                  ? <EmptyState icon="✅" title="No stories pushed to ADO yet" subtitle="Approve stories from the Slack or Documents tab to push them to ADO" />
                  : adoStories.map((s) => renderAdoCard(s))
              )}
            </>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isEditPanelOpen && (
        <div role="presentation" onClick={() => setIsEditPanelOpen(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 99 }} />
      )}

      {/* Edit panel */}
      {isEditPanelOpen && (
        <div style={{ position: "fixed", right: 0, top: 0, width: 580, height: "100vh", backgroundColor: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#1e293b" }}>Edit Story</h2>
            <button type="button" onClick={() => setIsEditPanelOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#64748b" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Story Title</label>
              <input value={editForm.storyTitle} onChange={(e) => setEditForm({ ...editForm, storyTitle: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Type</label>
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}>
                  <option>Bug</option><option>Story</option><option>Feature</option><option>Task</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Priority</label>
                <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}>
                  <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Sprint</label>
              <select value={editForm.sprint} onChange={(e) => setEditForm({ ...editForm, sprint: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}>
                <option>Current</option><option>Next</option><option>Backlog</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Assignee</label>
              <input value={editForm.assignee} onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Area Path</label>
              <input value={editForm.areaPath} onChange={(e) => setEditForm({ ...editForm, areaPath: e.target.value })}
                placeholder="Project\Area\Feature"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Tags</label>
              <input
                value={editForm.tags.join(", ")}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="tag1, tag2, tag3"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Figma Link</label>
              <input value={editForm.figmaLink} onChange={(e) => setEditForm({ ...editForm, figmaLink: e.target.value })}
                placeholder="https://figma.com/..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Description</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="As a [user] I need [what] So that [value]"
                style={{ width: "100%", height: 100, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>User Flow</label>
              <textarea value={editForm.userFlow} onChange={(e) => setEditForm({ ...editForm, userFlow: e.target.value })}
                style={{ width: "100%", height: 80, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>UI Behavior</label>
              <textarea value={editForm.uiBehavior} onChange={(e) => setEditForm({ ...editForm, uiBehavior: e.target.value })}
                style={{ width: "100%", height: 80, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Acceptance Criteria</label>
              {editForm.acceptanceCriteria.map((ac, idx) => (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0088ff", marginBottom: 4 }}>{ac.id || `AC ${idx + 1}`}</div>
                  <textarea value={ac.scenario}
                    onChange={(e) => {
                      const updated = [...editForm.acceptanceCriteria];
                      updated[idx] = { ...updated[idx], scenario: e.target.value };
                      setEditForm({ ...editForm, acceptanceCriteria: updated });
                    }}
                    placeholder="Given [context] When [action] Then [result]"
                    style={{ width: "100%", height: 72, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
                </div>
              ))}
              <button type="button"
                onClick={() => setEditForm({ ...editForm, acceptanceCriteria: [...editForm.acceptanceCriteria, { id: `AC ${editForm.acceptanceCriteria.length + 1}`, scenario: "" }] })}
                style={{ border: "1px dashed #0088ff", color: "#0088ff", background: "transparent", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, width: "100%" }}>
                + Add Acceptance Criteria
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>Release Notes</label>
              <textarea value={editForm.releaseNotes} onChange={(e) => setEditForm({ ...editForm, releaseNotes: e.target.value })}
                style={{ width: "100%", height: 80, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsEditPanelOpen(false)}
              style={{ padding: "10px 24px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 }}>Cancel</button>
            <button type="button" onClick={handleSaveEdit}
              style={{ padding: "10px 24px", backgroundColor: "#0088ff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Save Changes</button>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default ReviewQueuePage;
