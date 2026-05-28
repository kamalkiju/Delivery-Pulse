// ─────────────────────────────────────────────
// SlackMessagesPage — two-panel Slack inbox + AI story detail
// Data: GET /api/slack/messages + GET /api/slack/messages/:id
// ─────────────────────────────────────────────

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Check, Image as ImageIcon, Search } from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import StatusBadge, { type BadgeVariant } from "../../components/ui/StatusBadge";
import TicketId from "../../components/ui/TicketId";
import {
  approveStoryById,
  getMessageDetail,
  getSlackMessages,
  rejectStoryById,
  type SlackMessageDetail,
  type SlackMessageListItem,
  type SlackWorkspaceInfo,
} from "../../api/slack.api";
import { getSlackStatus } from "../../api/slack.integration.api";
import { useWorkspaceChange } from "../../hooks/useWorkspaceChange";
import { useActiveWorkspace } from "../../hooks/useActiveWorkspace";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

type FilterTab = "all" | "client" | "unprocessed" | "today";

const REFRESH_MS = 30_000;

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function typeBorderColor(type: string) {
  const t = type.toLowerCase();
  if (t === "bug") return colors.danger;
  if (t === "feature") return colors["success-dark"];
  return colors.info;
}

function Avatar({
  initials,
  size,
  bg,
}: {
  initials: string;
  size: number;
  bg: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius.full,
        backgroundColor: bg,
        color: colors["text-on-dark"],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize:
          size <= 26 ? typography.captionSm.size : typography.listMeta.size,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="dashboard-skeleton"
          style={{
            height: "104px",
            margin: spacing[3],
            borderRadius: borderRadius.md,
            backgroundColor: colors["border-default"],
          }}
        />
      ))}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ padding: spacing[5], display: "flex", flexDirection: "column", gap: spacing[4] }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="dashboard-skeleton"
          style={{
            height: i === 0 ? "120px" : "80px",
            borderRadius: borderRadius.md,
            backgroundColor: colors["border-default"],
          }}
        />
      ))}
    </div>
  );
}

function FilterTabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`dp-tab ${active ? "dp-tab--active" : ""}`}
      onClick={onClick}
      style={{
        padding: `${spacing[2]} 0`,
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
      }}
    >
      <span
        style={{
          fontSize: typography.bodySm.size,
          fontWeight: active ? 700 : 400,
          color: active ? colors["brand-blue"] : colors["text-secondary"],
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: typography.captionSm.size,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: borderRadius.full,
          backgroundColor: active ? colors["brand-blue"] : colors.canvas,
          color: active ? colors["text-on-dark"] : colors["text-secondary"],
        }}
      >
        {count}
      </span>
    </button>
  );
}

const SlackMessagesPage = () => {
  const navigate = useNavigate();

  // messages — list from GET /api/slack/messages (scoped to logged-in organisation)
  const [messages, setMessages] = useState<SlackMessageListItem[]>([]);
  // workspace — connected Slack workspace for this organisation
  const [workspace, setWorkspace] = useState<SlackWorkspaceInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; teamId: string; teamName: string; teamIcon?: string | null }>
  >([]);
  const { displayName: activeWorkspaceLabel } = useActiveWorkspace();
  const [slackConnected, setSlackConnected] = useState(false);
  // selectedMessageId — drives GET /api/slack/messages/:id
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SlackMessageDetail | null>(null);
  // isLoading — initial list fetch
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch messages — org + active workspace via x-workspace-id (axios interceptor)
  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const { messages: list, workspace: ws, workspaces: wsList } =
        await getSlackMessages();
      setMessages(list);
      setWorkspace(ws);
      setWorkspaces(wsList);
      setSlackConnected(ws.connected);
      setSelectedMessageId((prev) => {
        if (prev && list.some((m) => m.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setError("Could not load Slack messages.");
      setMessages([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useWorkspaceChange(
    useCallback(() => {
      fetchMessages(true);
    }, [fetchMessages]),
  );

  // Connection status dot — GET /api/slack/status on mount
  useEffect(() => {
    getSlackStatus()
      .then((s) => setSlackConnected(s.connected))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const workspaceDisplayName =
    activeWorkspaceLabel ??
    workspace?.displayName ??
    (workspace?.teamName ? `${workspace.teamName} Workspace` : null);

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedMessageId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      setIsDetailLoading(true);
      try {
        const data = await getMessageDetail(selectedMessageId);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setIsDetailLoading(false);
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedMessageId]);

  const filterCounts = {
    all: messages.length,
    client: messages.filter((m) => m.isExternal).length,
    unprocessed: messages.filter((m) => !m.aiProcessed).length,
    today: messages.filter((m) => isToday(m.createdAt)).length,
  };

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: filterCounts.all },
    { id: "client", label: "Client", count: filterCounts.client },
    { id: "unprocessed", label: "Unprocessed", count: filterCounts.unprocessed },
    { id: "today", label: "Today", count: filterCounts.today },
  ];

  const filteredMessages = messages.filter((m) => {
    if (activeFilter === "client" && !m.isExternal) return false;
    if (activeFilter === "unprocessed" && m.aiProcessed) return false;
    if (activeFilter === "today" && !isToday(m.createdAt)) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.senderName.toLowerCase().includes(q) ||
      m.channelName.toLowerCase().includes(q) ||
      m.messageText.toLowerCase().includes(q) ||
      m.company.toLowerCase().includes(q)
    );
  });

  const selected =
    messages.find((m) => m.id === selectedMessageId) ?? filteredMessages[0];

  const handleApprove = async () => {
    const storyId = detail?.generatedStory?.id ?? detail?.storyId;
    if (!storyId) return;
    setActionLoading(true);
    try {
      await approveStoryById(storyId);
      await fetchMessages(true);
      if (selectedMessageId) {
        const updated = await getMessageDetail(selectedMessageId);
        setDetail(updated);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const storyId = detail?.generatedStory?.id ?? detail?.storyId;
    if (!storyId) return;
    setActionLoading(true);
    try {
      await rejectStoryById(storyId);
      await fetchMessages(true);
      if (selectedMessageId) {
        const updated = await getMessageDetail(selectedMessageId);
        setDetail(updated);
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell pageTitle="Slack" showWorkspaceContext>
      <div
        style={{
          margin: `-${spacing[6]}`,
          height: "calc(100vh - 60px)",
          display: "flex",
          overflow: "hidden",
          backgroundColor: colors.canvas,
        }}
      >
        {/* LEFT — message list */}
        <aside
          style={{
            width: "280px",
            flexShrink: 0,
            backgroundColor: colors["surface-card"],
            borderRight: `1px solid ${colors["border-default"]}`,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: spacing[4],
              borderBottom: `1px solid ${colors["border-default"]}`,
            }}
          >
            <h2
              style={{
                margin: `0 0 ${spacing[2]} 0`,
                fontSize: typography.bodyLg.size,
                fontWeight: 700,
                color: colors["text-primary"],
              }}
            >
              Slack messages
            </h2>

            <div
              style={{
                marginBottom: spacing[3],
                padding: `${spacing[2]} ${spacing[3]}`,
                borderRadius: borderRadius.md,
                backgroundColor: colors["surface-blue-tint"],
                border: `1px solid ${colors["border-default"]}`,
              }}
            >
              <div
                style={{
                  fontSize: typography.captionSm.size,
                  fontWeight: 600,
                  color: colors["text-tertiary"],
                  marginBottom: spacing[1],
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Active workspace
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[2],
                }}
              >
                <span
                  title={slackConnected ? "Connected" : "Not connected"}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: borderRadius.full,
                    flexShrink: 0,
                    backgroundColor: slackConnected
                      ? colors["success-dark"]
                      : colors["text-tertiary"],
                  }}
                />
                <span
                  style={{
                    fontSize: typography.bodySm.size,
                    fontWeight: 700,
                    color: colors["text-primary"],
                  }}
                >
                  {workspaceDisplayName ?? "No workspace connected"}
                </span>
              </div>
              {workspaces.length > 1 && (
                <p
                  style={{
                    margin: `${spacing[1]} 0 0`,
                    fontSize: typography.captionSm.size,
                    color: colors["text-tertiary"],
                  }}
                >
                  Use the sidebar switcher to change workspace
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[2],
                height: "36px",
                padding: `0 ${spacing[3]}`,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors["border-default"]}`,
                backgroundColor: colors["surface-subtle"],
              }}
            >
              <Search size={14} color={colors["text-tertiary"]} aria-hidden />
              <input
                type="search"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: typography.bodySm.size,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: spacing[4],
              padding: `0 ${spacing[4]}`,
              borderBottom: `1px solid ${colors["border-default"]}`,
            }}
          >
            {filterTabs.map((tab) => (
              <FilterTabButton
                key={tab.id}
                label={tab.label}
                count={tab.count}
                active={activeFilter === tab.id}
                onClick={() => setActiveFilter(tab.id)}
              />
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {isLoading ? (
              <ListSkeleton />
            ) : error ? (
              <p
                style={{
                  padding: spacing[4],
                  color: colors.danger,
                  fontSize: typography.bodySm.size,
                }}
              >
                {error}
              </p>
            ) : filteredMessages.length === 0 ? (
              <p
                style={{
                  padding: spacing[4],
                  color: colors["text-secondary"],
                  fontSize: typography.bodySm.size,
                  lineHeight: 1.5,
                }}
              >
                No messages yet. Waiting for client messages in Slack...
              </p>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = msg.id === selectedMessageId;
                return (
                  <button
                    key={msg.id}
                    type="button"
                    className={`dp-list-item dp-list-item--plain ${isSelected ? "dp-list-item--selected" : ""}`}
                    onClick={() => setSelectedMessageId(msg.id)}
                    style={{ minHeight: "104px", padding: spacing[3] }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: spacing[2],
                        alignItems: "flex-start",
                      }}
                    >
                      <Avatar
                        initials={msg.initials}
                        size={26}
                        bg={msg.avatarColor}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            marginBottom: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: typography.listTitle.size,
                              fontWeight: typography.listTitle.weight,
                              color: colors["text-primary"],
                            }}
                          >
                            {msg.senderName}
                          </span>
                          <span
                            style={{
                              fontSize: typography.listMeta.size,
                              color: colors["text-tertiary"],
                              flexShrink: 0,
                            }}
                          >
                            {msg.time}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: "0 0 2px",
                            fontSize: typography.listMeta.size,
                            color: colors["text-secondary"],
                          }}
                        >
                          {msg.company || msg.clientName}
                        </p>
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontFamily: typography.monoSm.fontFamily,
                            fontSize: typography.listMeta.size,
                            color: colors["text-tertiary"],
                          }}
                        >
                          {msg.sourceLine ??
                            `From: ${msg.channelName} · ${msg.workspaceName ?? workspace?.teamName ?? "Workspace"}`}
                        </p>
                        <p
                          style={{
                            margin: "0 0 6px",
                            fontSize: typography.listBody.size,
                            color: colors["text-secondary"],
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: 1.45,
                          }}
                        >
                          {msg.messageText || "(no text)"}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: spacing[1],
                          }}
                        >
                          <StatusBadge
                            variant={msg.statusVariant as BadgeVariant}
                            label={msg.statusLabel}
                          />
                          <StatusBadge
                            variant={msg.isExternal ? "at-risk" : "info"}
                            label={msg.isExternal ? "Client" : "Internal"}
                          />
                          {msg.hasImage && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                                fontSize: typography.captionSm.size,
                                color: colors["text-tertiary"],
                              }}
                            >
                              <ImageIcon size={12} aria-hidden />
                              Image
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT — detail */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            backgroundColor: colors["surface-card"],
          }}
        >
          {!selected && !isLoading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors["text-secondary"],
                fontSize: typography.bodySm.size,
              }}
            >
              Select a message to view details
            </div>
          ) : (
            <>
              <div
                style={{
                  height: "56px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `0 ${spacing[5]}`,
                  backgroundColor: colors["surface-subtle"],
                  borderBottom: `1px solid ${colors["border-default"]}`,
                }}
              >
                {selected && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[3],
                    }}
                  >
                    <Avatar
                      initials={selected.initials}
                      size={34}
                      bg={selected.avatarColor}
                    />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: typography.bodySm.size,
                          fontWeight: 700,
                          color: colors["text-primary"],
                        }}
                      >
                        {selected.senderName}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: typography.monoSm.size,
                          color: colors["text-tertiary"],
                        }}
                      >
                        {selected.isExternal ? "Client" : "Internal"} ·{" "}
                        {selected.company || selected.clientName}
                      </p>
                    </div>
                  </div>
                )}
                {detail?.storyId && (
                  <button
                    type="button"
                    onClick={() => navigate("/review")}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: typography.bodySm.size,
                      fontWeight: 600,
                      color: colors["brand-blue"],
                      cursor: "pointer",
                    }}
                  >
                    View in Review Queue →
                  </button>
                )}
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
                {isDetailLoading ? (
                  <DetailSkeleton />
                ) : detail ? (
                  <>
                    {/* Original message */}
                    <section
                      style={{
                        backgroundColor: colors["surface-subtle"],
                        border: `1px solid ${colors["border-default"]}`,
                        borderRadius: borderRadius.md,
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: spacing[3],
                          marginBottom: spacing[3],
                        }}
                      >
                        <Avatar
                          initials={detail.initials}
                          size={28}
                          bg={detail.avatarColor}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                fontSize: typography.bodySm.size,
                                fontWeight: 700,
                              }}
                            >
                              {detail.senderName}
                            </span>
                            <span
                              style={{
                                fontSize: typography.monoSm.size,
                                color: colors["text-tertiary"],
                              }}
                            >
                              {detail.time}
                            </span>
                          </div>
                          <span
                            style={{
                              fontFamily: typography.monoSm.fontFamily,
                              fontSize: typography.monoSm.size,
                              color: colors["text-tertiary"],
                            }}
                          >
                            {detail.sourceLine ??
                              `From: ${detail.channelName} · ${detail.workspaceName ?? workspace?.teamName ?? "Workspace"}`}
                          </span>
                        </div>
                      </div>
                      <p
                        style={{
                          margin: `0 0 ${spacing[3]}`,
                          fontSize: typography.bodySm.size,
                          color: colors["text-primary"],
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {detail.originalText || detail.messageText}
                      </p>
                      {detail.hasImage && (
                        <div
                          style={{
                            padding: spacing[3],
                            borderRadius: borderRadius.md,
                            border: `1px dashed ${colors["border-default"]}`,
                            backgroundColor: colors["surface-card"],
                            display: "flex",
                            alignItems: "center",
                            gap: spacing[2],
                            fontSize: typography.captionSm.size,
                            color: colors["text-secondary"],
                          }}
                        >
                          <ImageIcon size={16} aria-hidden />
                          {detail.imageUrl
                            ? "Screenshot attached (private Slack URL)"
                            : "Image attachment"}
                        </div>
                      )}
                    </section>

                    {/* AI analysis */}
                    {detail.aiAnalysis && (
                      <section
                        style={{
                          backgroundColor: "#EDE9FE",
                          border: "1px solid #C4B5FD",
                          borderRadius: borderRadius.md,
                          padding: spacing[3],
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: spacing[2],
                            marginBottom: spacing[3],
                          }}
                        >
                          <Bot size={18} color="#7c3aed" aria-hidden />
                          <span
                            style={{
                              fontSize: typography.bodySm.size,
                              fontWeight: 700,
                              color: "#7c3aed",
                            }}
                          >
                            AI Analysis
                          </span>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: spacing[2],
                          }}
                        >
                          {detail.aiAnalysis.type && (
                            <MetaChip label="Type" value={detail.aiAnalysis.type} />
                          )}
                          {detail.aiAnalysis.priority && (
                            <MetaChip
                              label="Priority"
                              value={detail.aiAnalysis.priority}
                            />
                          )}
                          {detail.aiAnalysis.status && (
                            <MetaChip
                              label="Status"
                              value={detail.aiAnalysis.status}
                            />
                          )}
                        </div>
                        {detail.aiAnalysis.summary && (
                          <p
                            style={{
                              margin: `${spacing[3]} 0 0`,
                              fontSize: typography.captionSm.size,
                              color: colors["text-secondary"],
                            }}
                          >
                            {detail.aiAnalysis.summary}
                          </p>
                        )}
                      </section>
                    )}

                    {/* Generated story */}
                    {detail.generatedStory && (
                      <section
                        style={{
                          backgroundColor: colors["surface-card"],
                          border: `1px solid ${colors["border-default"]}`,
                          borderLeft: `4px solid ${typeBorderColor(detail.generatedStory.type)}`,
                          borderRadius: `0 ${borderRadius.md} ${borderRadius.md} 0`,
                          padding: spacing[4],
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: spacing[2],
                            alignItems: "center",
                            marginBottom: spacing[3],
                          }}
                        >
                          <StatusBadge
                            variant={
                              detail.generatedStory.type === "Bug"
                                ? "critical"
                                : "info"
                            }
                            label={detail.generatedStory.type}
                          />
                          <TicketId id={detail.generatedStory.ticketId} />
                          {detail.aiProcessed && (
                            <span
                              style={{
                                fontSize: typography.captionSm.size,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: borderRadius.full,
                                backgroundColor: "#EDE9FE",
                                color: "#7c3aed",
                              }}
                            >
                              AI Generated
                            </span>
                          )}
                          <StatusBadge
                            variant={
                              detail.generatedStory.priority === "Critical"
                                ? "critical"
                                : detail.generatedStory.priority === "High"
                                  ? "at-risk"
                                  : "healthy"
                            }
                            label={detail.generatedStory.priority}
                          />
                        </div>
                        <h3
                          style={{
                            margin: `0 0 ${spacing[3]} 0`,
                            fontSize: typography.bodySm.size,
                            fontWeight: 700,
                            color: colors["text-primary"],
                            lineHeight: 1.4,
                          }}
                        >
                          {detail.generatedStory.title}
                        </h3>
                        {detail.generatedStory.description && (
                          <p
                            style={{
                              margin: `0 0 ${spacing[3]} 0`,
                              fontSize: typography.captionSm.size,
                              color: colors["text-secondary"],
                            }}
                          >
                            {detail.generatedStory.description}
                          </p>
                        )}
                        <ul
                          style={{
                            margin: `0 0 ${spacing[3]} ${spacing[4]}`,
                            padding: 0,
                            listStyle: "none",
                            display: "flex",
                            flexDirection: "column",
                            gap: spacing[2],
                          }}
                        >
                          {detail.generatedStory.acceptanceCriteria.map(
                            (ac) => (
                              <li
                                key={ac}
                                style={{
                                  display: "flex",
                                  gap: spacing[2],
                                  fontSize: typography.captionSm.size,
                                  color: colors["text-secondary"],
                                }}
                              >
                                <Check
                                  size={14}
                                  color={colors.success}
                                  style={{ flexShrink: 0 }}
                                />
                                {ac}
                              </li>
                            ),
                          )}
                        </ul>
                        <div
                          style={{
                            backgroundColor: colors["surface-subtle"],
                            padding: spacing[3],
                            borderRadius: borderRadius.sm,
                            fontSize: typography.captionSm.size,
                            color: colors["text-secondary"],
                            fontStyle: "italic",
                          }}
                        >
                          Client said: {detail.generatedStory.sourceQuote}
                        </div>
                      </section>
                    )}

                    {detail.autoReplySent && (
                      <section
                        style={{
                          backgroundColor: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: borderRadius.md,
                          padding: spacing[3],
                          display: "flex",
                          gap: spacing[3],
                        }}
                      >
                        <Check
                          size={18}
                          color={colors["success-dark"]}
                          style={{ flexShrink: 0, marginTop: 2 }}
                        />
                        <p
                          style={{
                            margin: 0,
                            fontSize: typography.bodySm.size,
                            color: colors["success-dark"],
                          }}
                        >
                          Auto-reply sent in {detail.channelName}
                        </p>
                      </section>
                    )}

                    {/* Actions */}
                    {detail.generatedStory &&
                      detail.generatedStory.status === "pending-review" && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: spacing[2],
                            paddingTop: spacing[2],
                          }}
                        >
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleApprove}
                            style={btnGreen}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() =>
                              navigate("/review", {
                                state: { storyId: detail.generatedStory?.id },
                              })
                            }
                            style={btnBlue}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleReject}
                            style={btnRed}
                          >
                            Reject
                          </button>
                          <button type="button" style={btnGray}>
                            Ask Client
                          </button>
                        </div>
                      )}
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
};

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        fontSize: typography.captionSm.size,
        backgroundColor: "rgba(255,255,255,0.6)",
        padding: "6px 8px",
        borderRadius: borderRadius.sm,
      }}
    >
      <span style={{ color: colors["text-tertiary"] }}>{label}: </span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const btnBase: CSSProperties = {
  padding: `${spacing[2]} ${spacing[4]}`,
  border: "none",
  borderRadius: borderRadius.md,
  fontSize: typography.bodySm.size,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGreen: CSSProperties = {
  ...btnBase,
  backgroundColor: colors["success-dark"],
  color: colors["text-on-dark"],
};

const btnBlue: CSSProperties = {
  ...btnBase,
  backgroundColor: colors.info,
  color: colors["text-on-dark"],
};

const btnRed: CSSProperties = {
  ...btnBase,
  backgroundColor: colors.danger,
  color: colors["text-on-dark"],
};

const btnGray: CSSProperties = {
  ...btnBase,
  backgroundColor: colors["text-tertiary"],
  color: colors["text-on-dark"],
};

export default SlackMessagesPage;
