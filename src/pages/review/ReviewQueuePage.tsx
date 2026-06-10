import { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import api from "../../api/axios";

// ── Types ────────────────────────────────────────────────────────────────────

interface AcItem {
  id: string;
  scenario: string;
}

interface Story {
  _id?: string;
  id?: string;
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
  adoId?: string;
  approvedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  clientId?: { name: string; company?: string } | null;
  projectId?: { name: string; color?: string } | null;
}

interface EditForm {
  storyTitle: string;
  type: string;
  priority: string;
  description: string;
  acceptanceCriteria: AcItem[];
  releaseNotes: string;
}

// ── Colour maps ──────────────────────────────────────────────────────────────

const typeColors: Record<string, { bg: string; text: string; border: string }> = {
  Bug:     { bg: "#fef2f2", text: "#dc2626", border: "#dc2626" },
  Story:   { bg: "#eff6ff", text: "#2563eb", border: "#2563eb" },
  Feature: { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  Task:    { bg: "#fffbeb", text: "#d97706", border: "#d97706" },
};

const priorityColors: Record<string, string> = {
  Critical: "#dc2626",
  High:     "#ea580c",
  Medium:   "#d97706",
  Low:      "#16a34a",
};

const defaultTypeColor = typeColors.Story;

/** Safely resolve a story's ID regardless of whether it comes from the DTO (id) or raw MongoDB (_id). */
const sid = (story: Story): string => story._id ?? story.id ?? "";

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  subtitle,
  buttonText,
  buttonAction,
}: {
  icon: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  buttonAction?: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500, margin: "0 0 8px" }}>{title}</p>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>{subtitle}</p>
      {buttonText && buttonAction && (
        <button
          type="button"
          onClick={buttonAction}
          style={{ backgroundColor: "#0088ff", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}
        >
          {buttonText}
        </button>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const ReviewQueuePage = () => {
  const [activeTab, setActiveTab] = useState("slack");
  const [slackStories, setSlackStories]       = useState<Story[]>([]);
  const [documentStories, setDocumentStories] = useState<Story[]>([]);
  const [adoStories, setAdoStories]           = useState<Story[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [editingStory, setEditingStory]       = useState<Story | null>(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editForm, setEditForm]               = useState<EditForm>({
    storyTitle: "", type: "Story", priority: "Medium",
    description: "", acceptanceCriteria: [], releaseNotes: "",
  });
  const [expandedStories, setExpandedStories] = useState<Record<string, boolean>>({});

  const fetchAllStories = async () => {
    setIsLoading(true);
    try {
      const projectId = localStorage.getItem("activeProjectId") ?? "";
      const pp = projectId ? `&projectId=${projectId}` : "";

      // Single call for all pending stories — split into tabs by source on the frontend.
      // This avoids multiple concurrent tunnel/CORS requests that can fail independently.
      const res = await api.get(`/review${pp ? `?${pp.slice(1)}` : ""}`);
      const all: Story[] = res.data.stories ?? [];

      setSlackStories(all.filter((s) => !s.source || s.source === "slack" || s.source === "Slack"));
      setDocumentStories(all.filter((s) => s.source === "document" || s.source === "doc"));

      // Fetch approved stories for ADO tab separately
      try {
        const adoRes = await api.get(`/stories?status=approved${pp}`);
        const adoAll: Story[] = adoRes.data.stories ?? [];
        setAdoStories(adoAll);
      } catch {
        // ADO tab failing shouldn't break the main tabs
        setAdoStories([]);
      }
    } catch (err) {
      console.error("[ReviewQueue] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
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

  const handleEditClick = (story: Story) => {
    setEditingStory(story);
    const rawAcs = story.acceptanceCriteriaFormatted?.length
      ? story.acceptanceCriteriaFormatted
      : (story.acceptanceCriteria ?? []).map((ac, i) => ({
          id: `AC ${i + 1}`,
          scenario: typeof ac === "string" ? ac : ac.scenario ?? "",
        }));
    setEditForm({
      storyTitle:         story.storyTitle ?? story.title ?? "",
      type:               story.type ?? "Story",
      priority:           story.priority ?? "Medium",
      description:        story.description ?? "",
      acceptanceCriteria: rawAcs.map((ac) =>
        typeof ac === "string" ? { id: "", scenario: ac } : ac
      ),
      releaseNotes: story.releaseNotes ?? "",
    });
    setIsEditPanelOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStory) return;
    try {
      await api.patch(`/stories/${sid(editingStory)}`, {
        title:                      editForm.storyTitle,
        storyTitle:                 editForm.storyTitle,
        type:                       editForm.type,
        priority:                   editForm.priority,
        description:                editForm.description,
        acceptanceCriteria:         editForm.acceptanceCriteria.map((ac) => ac.scenario),
        acceptanceCriteriaFormatted: editForm.acceptanceCriteria,
        releaseNotes:               editForm.releaseNotes,
      });
      setIsEditPanelOpen(false);
      fetchAllStories();
    } catch {
      alert("Failed to save story");
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedStories((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Story card ─────────────────────────────────────────────────────────────

  const renderStoryCard = (story: Story, tabSource: string) => {
    const tc = typeColors[story.type] ?? defaultTypeColor;
    const storyId = sid(story);
    const isExpanded = expandedStories[storyId];
    const acItems: AcItem[] = (story.acceptanceCriteriaFormatted?.length
      ? story.acceptanceCriteriaFormatted
      : (story.acceptanceCriteria ?? []).map((ac, i) => ({
          id: `AC ${i + 1}`,
          scenario: typeof ac === "string" ? ac : ac.scenario ?? "",
        }))
    ).map((ac) => (typeof ac === "string" ? { id: "", scenario: ac } : ac));

    return (
      <div
        key={storyId}
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          borderLeft: `4px solid ${tc.border}`,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: "16px 20px" }}>
          {/* Badge row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ backgroundColor: tc.bg, color: tc.text, padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              {story.type}
            </span>
            <span style={{ backgroundColor: "#f1f5f9", color: "#475569", padding: "2px 10px", borderRadius: 999, fontSize: 12 }}>
              DP-{storyId.slice(-4).toUpperCase()}
            </span>
            <span style={{ backgroundColor: "#f0f0ff", color: "#6d28d9", padding: "2px 10px", borderRadius: 999, fontSize: 12 }}>
              ✨ AI Generated
            </span>
            <span style={{ backgroundColor: (priorityColors[story.priority] ?? "#94a3b8") + "20", color: priorityColors[story.priority] ?? "#94a3b8", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              {story.priority}
            </span>
            {tabSource === "slack" && (
              <span style={{ backgroundColor: "#f8f0ff", color: "#7c3aed", padding: "2px 10px", borderRadius: 999, fontSize: 12, border: "1px solid #e9d5ff" }}>💬 Slack</span>
            )}
            {tabSource === "document" && (
              <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", padding: "2px 10px", borderRadius: 999, fontSize: 12, border: "1px solid #fed7aa" }}>📄 Document</span>
            )}
          </div>

          {/* Title */}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
            {story.storyTitle ?? story.title}
          </h3>

          {/* Description */}
          {story.description && (
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px", lineHeight: 1.6 }}>
              {story.description}
            </p>
          )}

          {/* Original quote */}
          {story.sourceQuote && (
            <div style={{ backgroundColor: "#f8fafc", borderLeft: "3px solid #cbd5e1", padding: "8px 12px", borderRadius: "0 6px 6px 0", marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", margin: 0 }}>
                💬 Client said: "{story.sourceQuote}"
              </p>
            </div>
          )}

          {/* Acceptance criteria (collapsible) */}
          {acItems.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => toggleExpand(storyId)}
                style={{ background: "none", border: "none", color: "#0088ff", fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}
              >
                {isExpanded ? "▼" : "▶"} Acceptance Criteria ({acItems.length})
              </button>
              {isExpanded && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {acItems.map((ac, i) => (
                    <div key={i} style={{ backgroundColor: "#f8fafc", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: "#0088ff" }}>{ac.id || `AC ${i + 1}`}:</span>{" "}
                      {ac.scenario}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Release notes (when expanded) */}
          {story.releaseNotes && isExpanded && (
            <div style={{ backgroundColor: "#f0fdf4", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#166534" }}>
              <span style={{ fontWeight: 600 }}>📋 Release Notes: </span>{story.releaseNotes}
            </div>
          )}

          {/* Footer row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {story.clientId?.name && <span style={{ marginRight: 12 }}>👤 {story.clientId.name}</span>}
              {story.projectId?.name && <span style={{ marginRight: 12 }}>📁 {story.projectId.name}</span>}
              🕐 {new Date(story.createdAt ?? Date.now()).toLocaleDateString()}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => handleEditClick(story)} style={{ padding: "6px 16px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Edit</button>
              <button type="button" onClick={() => handleReject(storyId)} style={{ padding: "6px 16px", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Reject</button>
              <button type="button" onClick={() => handleApprove(storyId)} style={{ padding: "6px 16px", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Approve</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── ADO card ───────────────────────────────────────────────────────────────

  const renderAdoCard = (story: Story) => (
    <div key={sid(story)} style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", borderLeft: "4px solid #16a34a", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ backgroundColor: "#f0fdf4", color: "#16a34a", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>✅ Approved</span>
        {story.adoId && (
          <span style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>ADO #{story.adoId}</span>
        )}
        <span style={{ backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 10px", borderRadius: 999, fontSize: 12 }}>{story.type}</span>
        <span style={{ backgroundColor: (priorityColors[story.priority] ?? "#94a3b8") + "20", color: priorityColors[story.priority] ?? "#94a3b8", padding: "2px 10px", borderRadius: 999, fontSize: 12 }}>
          {story.priority}
        </span>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>
        {story.storyTitle ?? story.title}
      </h3>
      {story.description && (
        <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>{story.description}</p>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          Approved {new Date(story.approvedAt ?? story.updatedAt ?? Date.now()).toLocaleDateString()}
        </span>
        {story.adoId && (
          <a href="#" style={{ color: "#0088ff", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>
            View in ADO →
          </a>
        )}
      </div>
    </div>
  );

  // ── Tabs config ────────────────────────────────────────────────────────────

  const tabs = [
    { key: "slack",    label: "Slack Messages", count: slackStories.length,    icon: "💬" },
    { key: "document", label: "Documents",       count: documentStories.length, icon: "📄" },
    { key: "ado",      label: "ADO Stories",     count: adoStories.length,      icon: "✅" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell pageTitle="Review Queue">
      <div style={{ margin: "-24px", display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>

        {/* Header */}
        <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>Review Queue</h1>
              <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                Review and approve AI-generated stories before pushing to ADO
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
            <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>
              ⏳ {slackStories.length + documentStories.length} Pending
            </span>
            <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 500 }}>
              ✅ {adoStories.length} Approved
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", padding: "0 24px", flexShrink: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: activeTab === tab.key ? 600 : 500,
                cursor: "pointer",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #0088ff" : "2px solid transparent",
                color: activeTab === tab.key ? "#0088ff" : "#64748b",
                backgroundColor: "transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: -1,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{
                backgroundColor: activeTab === tab.key ? "#eff6ff" : "#f1f5f9",
                color: activeTab === tab.key ? "#0088ff" : "#64748b",
                borderRadius: 999,
                padding: "1px 8px",
                fontSize: 12,
                fontWeight: 600,
              }}>
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
          ) : (
            <>
              {activeTab === "slack" && (
                slackStories.length === 0
                  ? <EmptyState icon="💬" title="No Slack stories pending review" subtitle="Stories appear here when clients send messages in Slack" />
                  : slackStories.map((s) => renderStoryCard(s, "slack"))
              )}
              {activeTab === "document" && (
                documentStories.length === 0
                  ? <EmptyState icon="📄" title="No document stories pending review" subtitle="Upload a PRD or UAT document to generate stories automatically" buttonText="Upload Document" buttonAction={() => { window.location.href = "/documents"; }} />
                  : documentStories.map((s) => renderStoryCard(s, "document"))
              )}
              {activeTab === "ado" && (
                adoStories.length === 0
                  ? <EmptyState icon="✅" title="No stories pushed to ADO yet" subtitle="Approve stories from Slack or Documents tab to push to ADO" />
                  : adoStories.map((s) => renderAdoCard(s))
              )}
            </>
          )}
        </div>
      </div>

      {/* Overlay */}
      {isEditPanelOpen && (
        <div
          role="presentation"
          onClick={() => setIsEditPanelOpen(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 99 }}
        />
      )}

      {/* Edit panel */}
      {isEditPanelOpen && (
        <div style={{ position: "fixed", right: 0, top: 0, width: 580, height: "100vh", backgroundColor: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", zIndex: 100, display: "flex", flexDirection: "column" }}>
          {/* Panel header */}
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#1e293b" }}>Edit Story</h2>
            <button type="button" onClick={() => setIsEditPanelOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#64748b" }}>×</button>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {/* Story Title */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Story Title</label>
              <input value={editForm.storyTitle} onChange={(e) => setEditForm({ ...editForm, storyTitle: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>

            {/* Type + Priority */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</label>
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}>
                  <option>Bug</option><option>Story</option><option>Feature</option><option>Task</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Priority</label>
                <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}>
                  <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description & Value Statement</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="As a [user] I need [what] So that [value]"
                style={{ width: "100%", height: 100, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            {/* Acceptance Criteria */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Acceptance Criteria</label>
              {editForm.acceptanceCriteria.map((ac, idx) => (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0088ff", marginBottom: 4 }}>{ac.id || `AC ${idx + 1}`}</div>
                  <textarea
                    value={ac.scenario}
                    onChange={(e) => {
                      const updated = [...editForm.acceptanceCriteria];
                      updated[idx] = { ...updated[idx], scenario: e.target.value };
                      setEditForm({ ...editForm, acceptanceCriteria: updated });
                    }}
                    placeholder="Given [context] When [action] Then [result]"
                    style={{ width: "100%", height: 72, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, acceptanceCriteria: [...editForm.acceptanceCriteria, { id: `AC ${editForm.acceptanceCriteria.length + 1}`, scenario: "" }] })}
                style={{ border: "1px dashed #0088ff", color: "#0088ff", background: "transparent", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, width: "100%" }}
              >
                + Add Acceptance Criteria
              </button>
            </div>

            {/* Release Notes */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Release Notes</label>
              <textarea value={editForm.releaseNotes} onChange={(e) => setEditForm({ ...editForm, releaseNotes: e.target.value })}
                style={{ width: "100%", height: 80, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Panel footer */}
          <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsEditPanelOpen(false)}
              style={{ padding: "10px 24px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 }}>
              Cancel
            </button>
            <button type="button" onClick={handleSaveEdit}
              style={{ padding: "10px 24px", backgroundColor: "#0088ff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              Save Changes
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default ReviewQueuePage;
