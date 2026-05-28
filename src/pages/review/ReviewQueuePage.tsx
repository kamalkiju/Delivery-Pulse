// ─────────────────────────────────────────────
// ReviewQueuePage — BA story review queue before ADO publish
// Approve / edit / reject AI-generated stories
// ─────────────────────────────────────────────

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useWorkspaceChange } from "../../hooks/useWorkspaceChange";
import { useActiveWorkspace } from "../../hooks/useActiveWorkspace";
import type { ReviewWorkspaceInfo } from "../../api/review.api";
import { Check, Sparkles, X } from "lucide-react";
import axios from "axios";
import AppShell from "../../components/layout/AppShell";
import StatusBadge, { type BadgeVariant } from "../../components/ui/StatusBadge";
import TicketId from "../../components/ui/TicketId";
import {
  approveStory as approveStoryApi,
  editStory,
  fetchReviewQueue,
  rejectStory as rejectStoryApi,
  type ReviewQueueStats,
  type ReviewStory as ApiReviewStory,
} from "../../api/review.api";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

type StoryType = "bug" | "story" | "feature" | "task";
type StorySource = "slack" | "doc" | "meeting";
type StoryStatus = "pending" | "approved" | "rejected" | "edited";
type Priority = "Critical" | "High" | "Medium" | "Low";

interface ReviewStory extends ApiReviewStory {
  type: StoryType;
  source: StorySource;
  priority: Priority;
  status: StoryStatus;
}

/** Auto-refresh interval so new Slack stories appear without reload */
const REFRESH_MS = 20_000;

// Left border per work item type (exact spec colors)
const typeBorderColor: Record<StoryType, string> = {
  bug: "#DC2626",
  story: "#2563EB",
  feature: "#16A34A",
  task: "#D97706",
};

const typeBadgeVariant: Record<StoryType, BadgeVariant> = {
  bug: "critical",
  story: "info",
  feature: "healthy",
  task: "at-risk",
};

const typeLabelMap: Record<StoryType, string> = {
  bug: "Bug",
  story: "Story",
  feature: "Feature",
  task: "Task",
};

const sourceLabelMap: Record<StorySource, string> = {
  slack: "Slack",
  doc: "Document",
  meeting: "Meeting",
};

const priorityVariant: Record<Priority, BadgeVariant> = {
  Critical: "critical",
  High: "at-risk",
  Medium: "info",
  Low: "healthy",
};

function mapApiStory(s: ApiReviewStory): ReviewStory {
  const type = (["bug", "story", "feature", "task"].includes(s.type)
    ? s.type
    : "story") as StoryType;
  const source = (["slack", "doc", "meeting"].includes(s.source)
    ? s.source
    : "slack") as StorySource;
  const priority = (
    ["Critical", "High", "Medium", "Low"].includes(s.priority)
      ? s.priority
      : "Medium"
  ) as Priority;

  return {
    ...s,
    type,
    source,
    priority,
    status: "pending",
    acceptanceCriteria: s.acceptanceCriteria ?? [],
    sourceQuote: s.sourceQuote ?? "",
    sprint: s.sprint ?? "Backlog",
  };
}

// ── Page component ───────────────────────────────────────────

type ToastState = { message: string; variant: "success" | "error" } | null;

const defaultStats: ReviewQueueStats = {
  pending: 0,
  approvedToday: 0,
  rejected: 0,
  edited: 0,
};

const ReviewQueuePage = () => {
  const [stories, setStories] = useState<ReviewStory[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [queueStats, setQueueStats] = useState<ReviewQueueStats>(defaultStats);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewWorkspace, setReviewWorkspace] =
    useState<ReviewWorkspaceInfo | null>(null);
  const { displayName: activeWorkspaceLabel } = useActiveWorkspace();

  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    type: StoryType;
    priority: Priority;
    acceptanceCriteria: string[];
    sprint: string;
  } | null>(null);

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast({ message, variant });
    window.setTimeout(() => setToast(null), 4000);
  };

  /** GET /api/review — load pending stories + stats; silent=true skips full-page skeleton */
  const loadStories = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const { stories: data, stats, workspace } = await fetchReviewQueue();
      setStories(data.map(mapApiStory));
      setQueueStats(stats);
      setReviewWorkspace(workspace);
    } catch (err) {
      if (!silent) {
        setError(
          axios.isAxiosError(err)
            ? (err.response?.data?.message as string) ??
                "Could not load review queue."
            : "Could not load review queue.",
        );
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStories(false);
    const intervalId = window.setInterval(() => loadStories(true), REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [loadStories]);

  useWorkspaceChange(() => loadStories(true));

  const pendingStories = stories.filter((s) => s.status === "pending");
  const editingStory = stories.find((s) => s.id === selectedStoryId);

  const openEditPanel = (storyId: string) => {
    const story = stories.find((s) => s.id === storyId);
    if (!story) return;
    setSelectedStoryId(storyId);
    setEditDraft({
      title: story.title,
      description: story.description ?? story.sourceQuote ?? "",
      type: story.type,
      priority: story.priority,
      acceptanceCriteria: [...story.acceptanceCriteria],
      sprint: story.sprint ?? "Backlog",
    });
    setIsEditPanelOpen(true);
  };

  const closeEditPanel = () => {
    setIsEditPanelOpen(false);
    setSelectedStoryId(null);
    setEditDraft(null);
  };

  const removeFromQueue = (id: string) => {
    setStories((prev) => prev.filter((s) => s.id !== id));
    setCheckedIds((prev) => prev.filter((x) => x !== id));
  };

  const approveStory = async (id: string) => {
    setActionError(null);
    try {
      await approveStoryApi(id);
      removeFromQueue(id);
      setQueueStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        approvedToday: prev.approvedToday + 1,
      }));
      showToast("Story approved and pushed to ADO");
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? (err.response?.data?.message as string) ?? "Approve failed."
          : "Approve failed.",
      );
    }
  };

  const rejectStory = async (id: string) => {
    setActionError(null);
    try {
      await rejectStoryApi(id);
      removeFromQueue(id);
      setQueueStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        rejected: prev.rejected + 1,
      }));
      showToast("Story rejected");
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? (err.response?.data?.message as string) ?? "Reject failed."
          : "Reject failed.",
      );
    }
  };

  const approveAllPending = async () => {
    setActionError(null);
    let approved = 0;
    for (const s of [...pendingStories]) {
      try {
        await approveStoryApi(s.id);
        removeFromQueue(s.id);
        approved += 1;
      } catch (err) {
        setActionError(
          axios.isAxiosError(err)
            ? (err.response?.data?.message as string) ?? "Bulk approve failed."
            : "Bulk approve failed.",
        );
        break;
      }
    }
    if (approved > 0) {
      setQueueStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - approved),
        approvedToday: prev.approvedToday + approved,
      }));
      showToast(
        approved === 1
          ? "Story approved and pushed to ADO"
          : `${approved} stories approved and pushed to ADO`,
      );
    }
    setCheckedIds([]);
  };

  const approveSelected = async () => {
    setActionError(null);
    let approved = 0;
    for (const id of [...checkedIds]) {
      try {
        await approveStoryApi(id);
        removeFromQueue(id);
        approved += 1;
      } catch (err) {
        setActionError(
          axios.isAxiosError(err)
            ? (err.response?.data?.message as string) ?? "Approve failed."
            : "Approve failed.",
        );
        break;
      }
    }
    if (approved > 0) {
      setQueueStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - approved),
        approvedToday: prev.approvedToday + approved,
      }));
      showToast(
        approved === 1
          ? "Story approved and pushed to ADO"
          : `${approved} stories approved and pushed to ADO`,
      );
    }
    setCheckedIds([]);
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (checkedIds.length === pendingStories.length) {
      setCheckedIds([]);
    } else {
      setCheckedIds(pendingStories.map((s) => s.id));
    }
  };

  /** PATCH /api/stories/:id — save edits and refresh card in list */
  const saveEdit = async () => {
    if (!selectedStoryId || !editDraft) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await editStory(selectedStoryId, {
        title: editDraft.title,
        description: editDraft.description,
        type: editDraft.type,
        priority: editDraft.priority,
        acceptanceCriteria: editDraft.acceptanceCriteria,
        sprint: editDraft.sprint,
      });
      setStories((prev) =>
        prev.map((s) =>
          s.id === selectedStoryId ? mapApiStory(updated) : s,
        ),
      );
      showToast("Story updated");
      closeEditPanel();
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? (err.response?.data?.message as string) ?? "Save failed."
          : "Save failed.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveAndApprove = async () => {
    if (!selectedStoryId || !editDraft) return;
    setIsSaving(true);
    setActionError(null);
    try {
      await editStory(selectedStoryId, {
        title: editDraft.title,
        description: editDraft.description,
        type: editDraft.type,
        priority: editDraft.priority,
        acceptanceCriteria: editDraft.acceptanceCriteria,
        sprint: editDraft.sprint,
      });
      await approveStoryApi(selectedStoryId);
      removeFromQueue(selectedStoryId);
      setQueueStats((prev) => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        approvedToday: prev.approvedToday + 1,
      }));
      showToast("Story approved and pushed to ADO");
      closeEditPanel();
    } catch (err) {
      setActionError(
        axios.isAxiosError(err)
          ? (err.response?.data?.message as string) ??
              "Save and approve failed."
          : "Save and approve failed.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell pageTitle="Review Queue" showWorkspaceContext>
      <div
        style={{
          margin: `-${spacing[6]}`,
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100vh - 60px)",
          backgroundColor: colors.canvas,
        }}
      >
        {/* ── STATS BAR ───────────────────────────────────── */}
        <div
          style={{
            height: "56px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${spacing[6]}`,
            backgroundColor: colors["surface-card"],
            borderBottom: `1px solid ${colors["border-default"]}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: spacing[6], flexWrap: "wrap" }}>
            {(reviewWorkspace?.displayName ?? activeWorkspaceLabel) && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  paddingRight: spacing[4],
                  borderRight: `1px solid ${colors["border-default"]}`,
                }}
              >
                <span
                  style={{
                    fontSize: typography.captionSm.size,
                    fontWeight: 600,
                    color: colors["text-tertiary"],
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Workspace
                </span>
                <span
                  style={{
                    fontSize: typography.bodySm.size,
                    fontWeight: 700,
                    color: colors["text-primary"],
                  }}
                >
                  {reviewWorkspace?.displayName ?? activeWorkspaceLabel}
                </span>
              </div>
            )}
            <StatPill
              label={`${queueStats.pending} Pending`}
              color={colors.warning}
            />
            <StatPill
              label={`${queueStats.approvedToday} Approved Today`}
              color={colors["success-dark"]}
            />
            <StatPill
              label={`${queueStats.rejected} Rejected`}
              color={colors.danger}
            />
          </div>
          <button type="button" onClick={approveAllPending} style={btnGreen}>
            Approve All
          </button>
        </div>

        {/* ── FILTER BAR ────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: spacing[2],
            padding: `${spacing[3]} ${spacing[6]}`,
            backgroundColor: colors.canvas,
          }}
        >
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <FilterDropdown label="All Sources" />
            <FilterDropdown label="All Types" />
            <FilterDropdown label="All Clients" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[2],
                fontSize: typography.bodySm.size,
                color: colors["text-secondary"],
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  pendingStories.length > 0 &&
                  checkedIds.length === pendingStories.length
                }
                onChange={toggleSelectAll}
              />
              Select All
            </label>
            <button
              type="button"
              onClick={approveSelected}
              disabled={checkedIds.length === 0}
              style={{
                ...btnGreen,
                opacity: checkedIds.length === 0 ? 0.5 : 1,
                cursor: checkedIds.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Approve Selected
            </button>
          </div>
        </div>

        {actionError != null && (
          <div
            role="alert"
            style={{
              margin: `0 ${spacing[6]}`,
              padding: spacing[3],
              backgroundColor: colors["danger-bg"],
              borderRadius: borderRadius.md,
              color: colors["danger-dark"],
              fontSize: typography.bodySm.size,
            }}
          >
            {actionError}
          </div>
        )}

        {/* ── STORY CARDS LIST ──────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: `0 ${spacing[6]} ${spacing[6]}`,
            display: "flex",
            flexDirection: "column",
            gap: spacing[2],
          }}
        >
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <StoryCardSkeleton key={`sk-${i}`} />
            ))}
          {error != null && !isLoading && (
            <p style={{ color: colors.danger }}>{error}</p>
          )}
          {!isLoading && !error && stories.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: spacing[8],
                gap: spacing[3],
                color: colors["text-secondary"],
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors["success-bg"],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={28} color={colors["success-dark"]} />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.bodyMd.size,
                  fontWeight: 600,
                  color: colors["text-primary"],
                }}
              >
                All caught up! No stories pending review
              </p>
            </div>
          )}
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              checked={checkedIds.includes(story.id)}
              onToggleCheck={() => toggleCheck(story.id)}
              onApprove={() => approveStory(story.id)}
              onReject={() => rejectStory(story.id)}
              onEdit={() => openEditPanel(story.id)}
            />
          ))}
        </div>
      </div>

      {/* ── SLIDE-IN EDIT PANEL ───────────────────────────── */}
      {isEditPanelOpen && editingStory && editDraft && (
        <>
          <div
            role="presentation"
            onClick={closeEditPanel}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.35)",
              zIndex: 200,
            }}
          />
          <aside
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              width: "460px",
              height: "100vh",
              backgroundColor: colors["surface-card"],
              boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
              zIndex: 201,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: spacing[5],
                borderBottom: `1px solid ${colors["border-default"]}`,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: typography.titleSm.size,
                  fontWeight: 700,
                  color: colors["text-primary"],
                }}
              >
                Edit Story {editingStory.ticketId}
              </h2>
              <button
                type="button"
                onClick={closeEditPanel}
                aria-label="Close"
                style={btnIcon}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: spacing[5],
                display: "flex",
                flexDirection: "column",
                gap: spacing[4],
              }}
            >
              <EditField label="Title">
                <input
                  type="text"
                  value={editDraft.title}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, title: e.target.value } : d,
                    )
                  }
                  style={inputStyle}
                />
              </EditField>
              <EditField label="Type">
                <select
                  value={editDraft.type}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d
                        ? { ...d, type: e.target.value as StoryType }
                        : d,
                    )
                  }
                  style={inputStyle}
                >
                  <option value="bug">Bug</option>
                  <option value="story">Story</option>
                  <option value="task">Task</option>
                  <option value="feature">Feature</option>
                </select>
              </EditField>
              <EditField label="Priority">
                <select
                  value={editDraft.priority}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d
                        ? { ...d, priority: e.target.value as Priority }
                        : d,
                    )
                  }
                  style={inputStyle}
                >
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </EditField>
              <EditField label="Description">
                <textarea
                  value={editDraft.description}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, description: e.target.value } : d,
                    )
                  }
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </EditField>
              <EditField label="Acceptance criteria">
                <ul style={{ margin: 0, paddingLeft: spacing[4] }}>
                  {editDraft.acceptanceCriteria.map((ac, idx) => (
                    <li
                      key={`${idx}-${ac}`}
                      style={{
                        fontSize: typography.bodySm.size,
                        marginBottom: spacing[2],
                      }}
                    >
                      {ac}
                    </li>
                  ))}
                </ul>
              </EditField>
              <EditField label="Sprint">
                <input
                  type="text"
                  value={editDraft.sprint}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, sprint: e.target.value } : d,
                    )
                  }
                  style={inputStyle}
                />
              </EditField>
              <EditField label="Assignee">
                <select defaultValue="unassigned" style={inputStyle}>
                  <option value="unassigned">Unassigned</option>
                  <option>Arun Kumar</option>
                  <option>Ravi Menon</option>
                </select>
              </EditField>
            </div>

            <div
              style={{
                padding: spacing[5],
                borderTop: `1px solid ${colors["border-default"]}`,
                display: "flex",
                alignItems: "center",
                gap: spacing[4],
              }}
            >
              <button
                type="button"
                onClick={saveEdit}
                disabled={isSaving}
                style={btnBlue}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={saveAndApprove}
                disabled={isSaving}
                style={btnGreen}
              >
                {isSaving ? "Saving…" : "Save and Approve"}
              </button>
              <button
                type="button"
                onClick={closeEditPanel}
                style={{
                  border: "none",
                  background: "transparent",
                  color: colors["text-secondary"],
                  fontSize: typography.bodySm.size,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Cancel
              </button>
            </div>
          </aside>
        </>
      )}

      {toast != null && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: spacing[6],
            right: spacing[6],
            zIndex: 300,
            padding: `${spacing[3]} ${spacing[5]}`,
            borderRadius: borderRadius.md,
            backgroundColor:
              toast.variant === "success"
                ? colors["success-dark"]
                : colors.danger,
            color: colors["text-on-dark"],
            fontSize: typography.bodySm.size,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {toast.message}
        </div>
      )}
    </AppShell>
  );
};

// ── Sub-components ───────────────────────────────────────────

function StatPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: "14px", fontWeight: 600, color }}>{label}</span>
  );
}

function FilterDropdown({ label }: { label: string }) {
  return (
    <button type="button" style={btnFilter}>
      {label} ▼
    </button>
  );
}

function StoryCardSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        backgroundColor: colors["surface-card"],
        border: `1px solid ${colors["border-default"]}`,
        borderRadius: borderRadius.md,
        padding: spacing[4],
        borderLeft: `4px solid ${colors["border-default"]}`,
      }}
    >
      <div
        style={{
          height: 12,
          width: "40%",
          backgroundColor: colors["surface-subtle"],
          borderRadius: borderRadius.sm,
          marginBottom: spacing[3],
        }}
      />
      <div
        style={{
          height: 16,
          width: "75%",
          backgroundColor: colors["surface-subtle"],
          borderRadius: borderRadius.sm,
          marginBottom: spacing[2],
        }}
      />
      <div
        style={{
          height: 12,
          width: "100%",
          backgroundColor: colors["surface-subtle"],
          borderRadius: borderRadius.sm,
        }}
      />
    </div>
  );
}

function StoryCard({
  story,
  checked,
  onToggleCheck,
  onApprove,
  onReject,
  onEdit,
}: {
  story: ReviewStory;
  checked: boolean;
  onToggleCheck: () => void;
  onReject: () => void;
  onApprove: () => void;
  onEdit: () => void;
}) {
  const typeLabel = typeLabelMap[story.type];
  const sourceLabel = sourceLabelMap[story.source];

  return (
    <article
      style={{
        backgroundColor: colors["surface-card"],
        border: `1px solid ${colors["border-default"]}`,
        borderLeft: `4px solid ${typeBorderColor[story.type]}`,
        borderRadius: borderRadius.md,
        padding: spacing[4],
        opacity: story.status === "rejected" ? 0.65 : 1,
      }}
    >
      {/* Top row: badges + meta + checkbox */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: spacing[2],
          marginBottom: spacing[2],
        }}
      >
        <StatusBadge variant={typeBadgeVariant[story.type]} label={typeLabel} />
        <TicketId id={story.ticketId} />
        {story.isAIGenerated !== false && (
          <span style={badgeAi}>
            <Sparkles size={10} style={{ verticalAlign: "middle", marginRight: 2 }} />
            AI
          </span>
        )}
        <span style={badgeSource}>{sourceLabel}</span>
        <span style={badgeClient}>{story.client}</span>
        <span style={{ marginLeft: "auto", fontSize: typography.monoSm.size, color: colors["text-tertiary"] }}>
          {story.timeAgo}
        </span>
        {story.status === "pending" && (
          <input type="checkbox" checked={checked} onChange={onToggleCheck} />
        )}
        {story.status === "approved" && (
          <StatusBadge variant="healthy" label="Approved" />
        )}
        {story.status === "rejected" && (
          <StatusBadge variant="critical" label="Rejected" />
        )}
        {story.status === "edited" && (
          <StatusBadge variant="info" label="Edited" />
        )}
      </div>

      {/* Title */}
      <h3
        style={{
          margin: `0 0 ${spacing[2]} 0`,
          fontSize: typography.bodySm.size,
          fontWeight: 700,
          color: colors["text-primary"],
          lineHeight: 1.4,
        }}
      >
        {story.title}
      </h3>

      {story.description && story.description !== story.sourceQuote && (
        <p
          style={{
            margin: `0 0 ${spacing[2]} 0`,
            fontSize: typography.captionSm.size,
            color: colors["text-secondary"],
            lineHeight: 1.45,
          }}
        >
          {story.description}
        </p>
      )}

      {/* Acceptance criteria */}
      <ul
        style={{
          margin: `0 0 ${spacing[3]} 0`,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: spacing[1],
        }}
      >
        {story.acceptanceCriteria.map((ac) => (
          <li
            key={ac}
            style={{
              display: "flex",
              gap: spacing[2],
              fontSize: typography.captionSm.size,
              color: colors["text-secondary"],
            }}
          >
            <Check size={14} color={colors["success-dark"]} style={{ flexShrink: 0 }} />
            {ac}
          </li>
        ))}
      </ul>

      {story.sourceQuote ? (
        <div style={quoteBox}>
          <div
            style={{
              fontSize: typography.captionSm.size,
              fontWeight: 600,
              color: colors["text-tertiary"],
              marginBottom: "2px",
            }}
          >
            Original:
          </div>
          <div
            style={{
              fontSize: typography.captionSm.size,
              fontStyle: "italic",
              color: colors["text-secondary"],
            }}
          >
            {story.sourceQuote}
          </div>
        </div>
      ) : null}

      {/* Meta row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[2],
          alignItems: "center",
          marginTop: spacing[3],
          marginBottom: spacing[3],
        }}
      >
        <StatusBadge
          variant={priorityVariant[story.priority]}
          label={story.priority}
        />
        <span style={badgeSprint}>{story.sprint}</span>
        {story.regressionWarning && (
          <span style={badgeWarning}>{story.regressionWarning}</span>
        )}
        {story.goLiveWarning && (
          <span style={badgeWarning}>{story.goLiveWarning}</span>
        )}
      </div>

      {/* Actions */}
      {story.status === "pending" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[2] }}>
          <button type="button" onClick={onApprove} style={btnGreenSm}>
            Approve
          </button>
          <button type="button" onClick={onEdit} style={btnBlueSm}>
            Edit
          </button>
          <button type="button" onClick={onReject} style={btnRedSm}>
            Reject
          </button>
          <button type="button" style={btnGraySm}>
            Preview
          </button>
        </div>
      )}
    </article>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: typography.labelMd.size,
          fontWeight: typography.labelMd.weight,
          color: colors["text-primary"],
          marginBottom: spacing[2],
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────

const btnGreen: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[4]}`,
  backgroundColor: colors["success-dark"],
  color: colors["text-on-dark"],
  border: "none",
  borderRadius: borderRadius.md,
  fontSize: typography.bodySm.size,
  fontWeight: 600,
  cursor: "pointer",
};

const btnBlue: React.CSSProperties = {
  ...btnGreen,
  backgroundColor: colors.info,
};

const btnGreenSm: React.CSSProperties = {
  ...btnGreen,
  padding: `${spacing[1]} ${spacing[3]}`,
  fontSize: typography.captionSm.size,
};

const btnBlueSm: React.CSSProperties = {
  ...btnGreenSm,
  backgroundColor: colors.info,
};

const btnRedSm: React.CSSProperties = {
  ...btnGreenSm,
  backgroundColor: colors.danger,
};

const btnGraySm: React.CSSProperties = {
  ...btnGreenSm,
  backgroundColor: colors["text-tertiary"],
};

const btnFilter: React.CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  backgroundColor: colors["surface-card"],
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  fontSize: typography.bodySm.size,
  color: colors["text-primary"],
  cursor: "pointer",
};

const btnIcon: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: spacing[1],
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: `${spacing[2]} ${spacing[3]}`,
  borderRadius: borderRadius.md,
  border: `1px solid ${colors["border-default"]}`,
  fontSize: typography.bodySm.size,
  boxSizing: "border-box",
};

const badgeAi: React.CSSProperties = {
  fontSize: typography.captionSm.size,
  fontWeight: 600,
  padding: "2px 6px",
  borderRadius: borderRadius.full,
  backgroundColor: "#EDE9FE",
  color: "#7c3aed",
};

const badgeSource: React.CSSProperties = {
  fontSize: typography.captionSm.size,
  fontWeight: 500,
  padding: "2px 6px",
  borderRadius: borderRadius.sm,
  backgroundColor: colors.canvas,
  color: colors["text-secondary"],
};

const badgeClient: React.CSSProperties = {
  fontSize: typography.captionSm.size,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: borderRadius.full,
  backgroundColor: colors["surface-subtle"],
  color: colors["text-secondary"],
};

const badgeSprint: React.CSSProperties = {
  fontSize: typography.monoSm.size,
  padding: "2px 8px",
  borderRadius: borderRadius.sm,
  backgroundColor: colors.canvas,
  color: colors["text-secondary"],
};

const badgeWarning: React.CSSProperties = {
  fontSize: typography.monoSm.size,
  padding: "2px 8px",
  borderRadius: borderRadius.sm,
  backgroundColor: colors["warning-bg"],
  color: colors["warning-dark"],
};

const quoteBox: React.CSSProperties = {
  backgroundColor: colors["surface-subtle"],
  borderRadius: borderRadius.sm,
  padding: "6px 8px",
};

export default ReviewQueuePage;
