// ─────────────────────────────────────────────
// MeetingsPage — two-panel Meetings Intelligence UI
// Figma: DeliveryPulse file zruDB5fMVZUyifLOtwftGK (node 2:1161)
// ─────────────────────────────────────────────

import { useMemo, useState, type CSSProperties } from "react"; // useState = UI that changes; useMemo = derived lists without re-filtering every render
import { Bot, Check, Clock, Video } from "lucide-react"; // Icons — same library as Slack / Settings pages
import AppShell from "../../components/layout/AppShell"; // Wraps Sidebar + TopNav; pageTitle shows "Meetings" in the header
import StatusBadge, { type BadgeVariant } from "../../components/ui/StatusBadge"; // Reusable status pills — story type badges on Summary tab
import TicketId from "../../components/ui/TicketId"; // Monospace ticket id chip — linked ADO story on regression card
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens"; // Shared colors, spacing, type scale — keeps UI consistent with DeliveryPulse

// ── Types ────────────────────────────────────────────────────

type ListFilterTab = "all" | "this-week" | "action-items" | "unprocessed"; // Left-panel filter tab ids

type ContentTab = "summary" | "transcript" | "stories" | "commitments"; // Right-panel content tab ids

type MeetingStatusKind = "stories-created" | "action-items" | "processing"; // Drives list status pill colors

interface MeetingListItem {
  id: string; // Unique key + selection id
  title: string; // Row title — e.g. "Sprint Review TechCorp"
  schedule: string; // When — e.g. "Today 3PM"
  duration: string; // Length — e.g. "45min"
  statusKind: MeetingStatusKind; // Which status color pair to use
  statusLabel: string; // Pill text — e.g. "3 stories created"
}

interface StoryMiniCard {
  type: "Bug" | "Story" | "Feature"; // Work item type — maps to StatusBadge variant
  severity: string; // Shown after type — e.g. "Critical"
  title: string; // Short headline under badges
  ticketId?: string; // Optional TicketId — e.g. "#341"
}

interface CommitmentItem {
  id: string;
  tone: "open" | "done"; // open = amber card, done = green card
  text: string;
  subtext: string;
  pillLabel: string;
}

interface TranscriptRow {
  id: string;
  speaker: string; // Chip label — e.g. "Arun Client"
  speakerTone: "client" | "team"; // client = amber chip, team = blue chip
  time: string;
  text: string;
  highlight?: "story" | "commitment"; // Row background tint
}

interface MeetingDetail {
  headerTitle: string;
  headerSub: string;
  attendeeChips: { label: string; bg: string; fg: string }[];
  summaryBullets: { dot: string; text: string }[];
  stories: StoryMiniCard[];
  commitments: CommitmentItem[];
  transcript: TranscriptRow[];
}

// List status pill colors — exact hex from spec
const statusBadgeStyles: Record<MeetingStatusKind, { bg: string; fg: string }> = {
  "stories-created": { bg: "#d1fae5", fg: "#15803d" },
  "action-items": { bg: "#fef3c7", fg: "#d97706" },
  processing: { bg: "#dbeafe", fg: "#1e40af" },
};

// Map story type → StatusBadge variant
const storyTypeVariant: Record<StoryMiniCard["type"], BadgeVariant> = {
  Bug: "critical",
  Story: "info",
  Feature: "healthy",
};

// ── Mock data (5 meetings + Sprint Review detail) ─────────────

const meetings: MeetingListItem[] = [
  {
    id: "m1",
    title: "Sprint Review TechCorp",
    schedule: "Today 3PM",
    duration: "45min",
    statusKind: "stories-created",
    statusLabel: "3 stories created",
  },
  {
    id: "m2",
    title: "Daily Standup GlobalRetail",
    schedule: "Today 10AM",
    duration: "15min",
    statusKind: "action-items",
    statusLabel: "2 action items",
  },
  {
    id: "m3",
    title: "Kickoff StartupXYZ",
    schedule: "Yesterday 2PM",
    duration: "90min",
    statusKind: "stories-created",
    statusLabel: "18 stories created",
  },
  {
    id: "m4",
    title: "Bug Review TechCorp",
    schedule: "22 May",
    duration: "30min",
    statusKind: "processing",
    statusLabel: "Processing",
  },
  {
    id: "m5",
    title: "UAT Review FinanceApp",
    schedule: "21 May",
    duration: "60min",
    statusKind: "stories-created",
    statusLabel: "6 stories created",
  },
];

const sprintReviewDetail: MeetingDetail = {
  headerTitle: "Sprint Review TechCorp Ltd",
  headerSub: "Today 3:00 to 3:45 PM · Teams · Transcript ready",
  attendeeChips: [
    { label: "Arun Client", bg: "#fef3c7", fg: "#92400e" },
    { label: "Priya Client", bg: "#fef3c7", fg: "#92400e" },
    { label: "Vijay PM", bg: "#dbeafe", fg: "#1e40af" },
    { label: "Sneha BA", bg: "#ede9fe", fg: "#5b21b6" },
    { label: "Deepak Dev", bg: "#d1fae5", fg: "#15803d" },
  ],
  summaryBullets: [
    { dot: colors.danger, text: "Dashboard loading critical — go-live Friday" },
    { dot: colors.warning, text: "Export button regression from Sprint 9" },
    { dot: colors.info, text: "Mobile view new feature next sprint" },
  ],
  stories: [
    { type: "Bug", severity: "Critical", title: "Dashboard slow load" },
    {
      type: "Story",
      severity: "High",
      title: "Export regression fix",
      ticketId: "#341",
    },
    { type: "Feature", severity: "Medium", title: "Mobile dashboard" },
  ],
  commitments: [
    {
      id: "c1",
      tone: "open",
      text: "Vijay PM committed to fix dashboard by Thursday",
      subtext: "Due Thu 25 May · 2 days left",
      pillLabel: "Open",
    },
    {
      id: "c2",
      tone: "done",
      text: "Sneha BA to send estimates by EOD",
      subtext: "Completed 5:30 PM today",
      pillLabel: "Done",
    },
  ],
  transcript: [
    {
      id: "t1",
      speaker: "Arun Client",
      speakerTone: "client",
      time: "3:02 PM",
      text: "The dashboard is still taking forever to load — we go live Friday.",
      highlight: "story",
    },
    {
      id: "t2",
      speaker: "Vijay PM",
      speakerTone: "team",
      time: "3:05 PM",
      text: "I'll get the dashboard fix in by Thursday — that's my commitment.",
      highlight: "commitment",
    },
    {
      id: "t3",
      speaker: "Sneha BA",
      speakerTone: "team",
      time: "3:12 PM",
      text: "Export broke again — looks like the Sprint 9 regression we discussed.",
      highlight: "story",
    },
    {
      id: "t4",
      speaker: "Priya Client",
      speakerTone: "client",
      time: "3:18 PM",
      text: "Can we prioritize a mobile dashboard view for the next sprint?",
    },
    {
      id: "t5",
      speaker: "Deepak Dev",
      speakerTone: "team",
      time: "3:32 PM",
      text: "I'll spike the mobile layout after the dashboard fix lands.",
    },
  ],
};

// ── Page ─────────────────────────────────────────────────────

export default function MeetingsPage() {
  // selectedMeetingId — which left-list card is highlighted (blue left border)
  const [selectedMeetingId, setSelectedMeetingId] = useState(meetings[0].id);
  // activeTab — Summary | Transcript | Stories | Commitments on the right
  const [activeTab, setActiveTab] = useState<ContentTab>("summary");
  // listFilter — All | This Week | Action Items | Unprocessed
  const [listFilter, setListFilter] = useState<ListFilterTab>("all");
  // searchQuery — filters meeting titles in the left list
  const [searchQuery, setSearchQuery] = useState("");
  // transcriptSearch — filters lines on the Transcript tab
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const filteredMeetings = useMemo(() => {
    let list = meetings;
    if (listFilter === "action-items") {
      list = list.filter((m) => m.statusKind === "action-items");
    }
    if (listFilter === "unprocessed") {
      list = list.filter((m) => m.statusKind === "processing");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q));
    }
    return list;
  }, [listFilter, searchQuery]);

  const detail = sprintReviewDetail; // Demo: all selections show Sprint Review content

  const filteredTranscript = useMemo(() => {
    if (!transcriptSearch.trim()) return detail.transcript;
    const q = transcriptSearch.toLowerCase();
    return detail.transcript.filter(
      (row) =>
        row.text.toLowerCase().includes(q) ||
        row.speaker.toLowerCase().includes(q),
    );
  }, [detail.transcript, transcriptSearch]);

  return (
    <AppShell pageTitle="Meetings">
      {/* FULL-BLEED SHELL — cancel AppShell 24px padding; two columns fill viewport below topnav */}
      <div
        style={{
          margin: `-${spacing[6]}`,
          height: "calc(100vh - 60px)",
          display: "flex",
          overflow: "hidden",
          backgroundColor: colors.canvas,
        }}
      >
        {/* ── LEFT PANEL — 260px meeting list ───────────────── */}
        <aside
          style={{
            width: "260px",
            flexShrink: 0,
            backgroundColor: colors["surface-card"],
            borderRight: `1px solid ${colors["border-default"]}`,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* HEADER — title + Connect Teams pill */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${colors["border-default"]}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing[2],
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 700,
                color: colors["text-primary"],
              }}
            >
              Meetings
            </h2>
            <button type="button" style={connectTeamsBtn}>
              Connect Teams
            </button>
          </div>

          {/* SEARCH — full-width input under header */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: `1px solid ${colors["border-default"]}`,
            }}
          >
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "36px",
                padding: `0 ${spacing[3]}`,
                border: `1px solid ${colors["border-default"]}`,
                borderRadius: borderRadius.md,
                fontSize: typography.captionMd.size,
                color: colors["text-primary"],
                outline: "none",
              }}
            />
          </div>

          {/* FILTER TABS — All, This Week, Action Items, Unprocessed */}
          <div
            style={{
              display: "flex",
              gap: spacing[1],
              padding: "8px 12px",
              borderBottom: `1px solid ${colors["border-default"]}`,
              flexWrap: "wrap",
            }}
          >
            {(
              [
                { id: "all", label: "All" },
                { id: "this-week", label: "This Week" },
                { id: "action-items", label: "Action Items" },
                { id: "unprocessed", label: "Unprocessed" },
              ] as { id: ListFilterTab; label: string }[]
            ).map((tab) => {
              const active = listFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`dp-tab ${active ? "dp-tab--active" : ""}`}
                  style={{ fontSize: typography.captionMd.size }}
                  onClick={() => setListFilter(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* MEETING LIST — scrollable cards */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {filteredMeetings.map((meeting) => {
              const selected = meeting.id === selectedMeetingId;
              const pill = statusBadgeStyles[meeting.statusKind];
              return (
                <button
                  key={meeting.id}
                  type="button"
                  className={`dp-list-item dp-list-item--accent ${selected ? "dp-list-item--selected" : ""}`}
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    gap: spacing[3],
                    alignItems: "flex-start",
                  }}
                  onClick={() => {
                    setSelectedMeetingId(meeting.id);
                    setActiveTab("summary");
                  }}
                >
                  <Video
                    size={16}
                    color="#0f766e"
                    style={{ flexShrink: 0, marginTop: 2 }}
                    aria-hidden
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: typography.captionMd.size,
                        fontWeight: 500,
                        color: colors["text-primary"],
                      }}
                    >
                      {meeting.title}
                    </div>
                    <div
                      style={{
                        marginTop: "2px",
                        fontSize: typography.tableHeader.size,
                        color: colors["text-tertiary"],
                      }}
                    >
                      {meeting.schedule} · {meeting.duration}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "5px",
                        fontSize: typography.badgeCount.size,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: borderRadius.full,
                        backgroundColor: pill.bg,
                        color: pill.fg,
                      }}
                    >
                      {meeting.statusLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── RIGHT PANEL — meeting detail ─────────────────── */}
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            backgroundColor: colors["surface-card"],
          }}
        >
          {/* MEETING HEADER — title, schedule, attendee chips */}
          <div
            style={{
              backgroundColor: colors["surface-subtle"],
              borderBottom: `1px solid ${colors["border-default"]}`,
              padding: "14px 20px",
            }}
          >
            <h1
              style={{
                margin: `0 0 ${spacing[1]} 0`,
                fontSize: typography.bodyLg.size,
                fontWeight: 700,
                color: colors["text-primary"],
              }}
            >
              {detail.headerTitle}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: typography.captionSm.size,
                color: colors["text-secondary"],
              }}
            >
              {detail.headerSub}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "5px",
                marginTop: spacing[2],
              }}
            >
              {detail.attendeeChips.map((chip) => (
                <span
                  key={chip.label}
                  style={{
                    fontSize: typography.tableHeader.size,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: borderRadius.full,
                    backgroundColor: chip.bg,
                    color: chip.fg,
                  }}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          {/* CONTENT TABS — below header, full width */}
          <div
            style={{
              display: "flex",
              gap: spacing[6],
              padding: "0 20px",
              borderBottom: `1px solid ${colors["border-default"]}`,
              flexShrink: 0,
            }}
          >
            {(
              [
                { id: "summary", label: "Summary" },
                { id: "transcript", label: "Transcript" },
                {
                  id: "stories",
                  label: `Stories ${detail.stories.length}`,
                },
                {
                  id: "commitments",
                  label: `Commitments ${detail.commitments.length}`,
                },
              ] as { id: ContentTab; label: string }[]
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`dp-tab ${active ? "dp-tab--active" : ""}`}
                  style={{ padding: `${spacing[3]} 0` }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB BODY — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {activeTab === "summary" && (
              <div style={{ padding: "20px" }}>
                {/* AI SUMMARY CARD */}
                <div style={aiSummaryCard}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: spacing[3],
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacing[2],
                      }}
                    >
                      <Bot size={18} color="#7c3aed" aria-hidden />
                      <span
                        style={{
                          fontSize: typography.captionMd.size,
                          fontWeight: 700,
                          color: "#5b21b6",
                        }}
                      >
                        AI Meeting Summary
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: typography.tableHeader.size,
                        color: colors["text-tertiary"],
                      }}
                    >
                      3.4s
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {detail.summaryBullets.map((bullet) => (
                      <li
                        key={bullet.text}
                        style={{
                          display: "flex",
                          gap: spacing[2],
                          fontSize: typography.bodySm.size,
                          color: colors["text-primary"],
                          lineHeight: 1.45,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: borderRadius.full,
                            backgroundColor: bullet.dot,
                            flexShrink: 0,
                            marginTop: 6,
                          }}
                        />
                        {bullet.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 3 STORIES CREATED — mini card grid */}
                <h3
                  style={{
                    margin: `0 0 ${spacing[2]} 0`,
                    fontSize: typography.captionMd.size,
                    fontWeight: 700,
                    color: colors["text-primary"],
                  }}
                >
                  3 Stories Created
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: spacing[2],
                    marginBottom: spacing[4],
                  }}
                >
                  {detail.stories.map((story) => (
                    <StoryMiniCardView key={story.title} story={story} />
                  ))}
                </div>

                {/* VERBAL COMMITMENTS */}
                <h3
                  style={{
                    margin: `${spacing[4]} 0 ${spacing[2]} 0`,
                    fontSize: typography.captionMd.size,
                    fontWeight: 700,
                    color: colors["text-primary"],
                  }}
                >
                  Verbal Commitments
                </h3>
                {detail.commitments.map((c, i) => (
                  <CommitmentCard
                    key={c.id}
                    commitment={c}
                    marginBottom={i === 0 ? 6 : 0}
                  />
                ))}
              </div>
            )}

            {activeTab === "transcript" && (
              <div style={{ padding: "20px" }}>
                <input
                  type="search"
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  placeholder="Search transcript..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "36px",
                    padding: `0 ${spacing[3]}`,
                    marginBottom: spacing[3],
                    border: `1px solid ${colors["border-default"]}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.captionMd.size,
                    outline: "none",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing[2],
                  }}
                >
                  {filteredTranscript.map((row) => (
                    <TranscriptLine key={row.id} row={row} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "stories" && (
              <div
                style={{
                  padding: "20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: spacing[2],
                }}
              >
                {detail.stories.map((story) => (
                  <StoryMiniCardView key={story.title} story={story} />
                ))}
              </div>
            )}

            {activeTab === "commitments" && (
              <div style={{ padding: "20px" }}>
                {detail.commitments.map((c, i) => (
                  <CommitmentCard
                    key={c.id}
                    commitment={c}
                    marginBottom={i === 0 ? 6 : 0}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

// ── Story mini card — StatusBadge + TicketId ─────────────────

function StoryMiniCardView({ story }: { story: StoryMiniCard }) {
  return (
    <div style={storyMiniCard}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[1],
          alignItems: "center",
        }}
      >
        <StatusBadge variant={storyTypeVariant[story.type]} label={story.type} />
        <span
          style={{
            fontSize: typography.tableHeader.size,
            fontWeight: 600,
            color: colors["text-secondary"],
          }}
        >
          {story.severity}
        </span>
      </div>
      <div
        style={{
          marginTop: spacing[2],
          fontSize: typography.captionMd.size,
          fontWeight: 500,
          color: colors["text-primary"],
          lineHeight: 1.35,
        }}
      >
        {story.title}
      </div>
      {story.ticketId && (
        <div style={{ marginTop: spacing[1] }}>
          <TicketId id={story.ticketId} />
        </div>
      )}
    </div>
  );
}

// ── Commitment row card ──────────────────────────────────────

function CommitmentCard({
  commitment,
  marginBottom,
}: {
  commitment: CommitmentItem;
  marginBottom?: number;
}) {
  const isOpen = commitment.tone === "open";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing[3],
        padding: "10px",
        borderRadius: borderRadius.md,
        marginBottom: marginBottom ?? 0,
        backgroundColor: isOpen ? "#fffbeb" : "#f0fdf4",
        border: `1px solid ${isOpen ? "#fde68a" : "#bbf7d0"}`,
      }}
    >
      <div style={{ display: "flex", gap: spacing[2], flex: 1 }}>
        {isOpen ? (
          <Clock size={16} color={colors["warning-dark"]} style={{ flexShrink: 0 }} aria-hidden />
        ) : (
          <Check size={16} color={colors["success-dark"]} style={{ flexShrink: 0 }} aria-hidden />
        )}
        <div>
          <div
            style={{
              fontSize: typography.bodySm.size,
              fontWeight: 600,
              color: colors["text-primary"],
              lineHeight: 1.4,
            }}
          >
            {commitment.text}
          </div>
          <div
            style={{
              fontSize: typography.tableHeader.size,
              color: colors["text-tertiary"],
              marginTop: spacing[1],
            }}
          >
            {commitment.subtext}
          </div>
        </div>
      </div>
      <span
        style={{
          fontSize: typography.badgeCount.size,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: borderRadius.full,
          backgroundColor: isOpen ? "#fef3c7" : "#d1fae5",
          color: isOpen ? colors["warning-dark"] : "#15803d",
          whiteSpace: "nowrap",
        }}
      >
        {commitment.pillLabel}
      </span>
    </div>
  );
}

// ── Transcript line ──────────────────────────────────────────

function TranscriptLine({ row }: { row: TranscriptRow }) {
  const chipBg = row.speakerTone === "client" ? "#fef3c7" : "#dbeafe";
  const chipFg = row.speakerTone === "client" ? "#92400e" : "#1e40af";
  const rowBg =
    row.highlight === "story"
      ? colors["surface-blue-tint"]
      : row.highlight === "commitment"
        ? "#fffbeb"
        : "transparent";

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
        padding: spacing[2],
        borderRadius: borderRadius.sm,
        backgroundColor: rowBg,
      }}
    >
      <span
        style={{
          fontSize: typography.tableHeader.size,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: borderRadius.full,
          backgroundColor: chipBg,
          color: chipFg,
          flexShrink: 0,
        }}
      >
        {row.speaker}
      </span>
      <span
        style={{
          fontSize: typography.badgeCount.size,
          color: colors["text-tertiary"],
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {row.time}
      </span>
      <p
        style={{
          margin: 0,
          flex: 1,
          fontSize: typography.captionSm.size,
          color: colors["text-primary"],
          lineHeight: 1.45,
        }}
      >
        {row.text}
      </p>
    </div>
  );
}

// ── Shared style objects ─────────────────────────────────────

const connectTeamsBtn: CSSProperties = {
  padding: "3px 10px",
  fontSize: "11px",
  fontWeight: 600,
  border: `1px solid ${colors["brand-blue"]}`,
  color: colors["brand-blue"],
  backgroundColor: colors["surface-card"],
  borderRadius: borderRadius.full,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const aiSummaryCard: CSSProperties = {
  backgroundColor: "#ede9fe",
  border: "1px solid #c4b5fd",
  borderRadius: borderRadius.md,
  padding: "14px",
  marginBottom: spacing[4],
};

const storyMiniCard: CSSProperties = {
  backgroundColor: colors["surface-card"],
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  padding: spacing[2],
};
