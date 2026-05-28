// ─────────────────────────────────────────────
// ClientDetailPage — single-client health detail
// Figma: DeliveryPulse screen-client-health-detail (node 2:332)
// ─────────────────────────────────────────────

import { useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getClientById } from "../../api/clients.api";
import AppShell from "../../components/layout/AppShell"; // pageTitle="Clients" in top nav
import StatusBadge from "../../components/ui/StatusBadge"; // Open / Done pills on commitments
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

type DetailTab = "overview" | "stories" | "messages" | "meetings" | "reports";

type ClientStatus = "healthy" | "at-risk" | "critical"; // critical → red gauge + alert banner

interface MiniStat {
  label: string;
  value: string;
}

interface IssueRow {
  label: string; // e.g. "Bugs Raised"
  count: number;
  fillColor: string; // Bar fill hex
}

interface MessagePreview {
  id: string;
  text: string;
  storyLink?: string;
}

interface CommitmentItem {
  id: string;
  text: string;
  status: "open" | "done";
}

interface ClientData {
  id: string;
  name: string;
  initials: string;
  industry: string;
  platform: string;
  since: string;
  contractValue: string;
  healthScore: number;
  scoreDelta: string;
  status: ClientStatus;
  statusLabel: string;
  stats: MiniStat[];
  scoreHistory: number[];
  issueBreakdown: IssueRow[];
  messages: MessagePreview[];
  sprintName: string;
  sprintProgress: number;
  sprintEnds: string;
  commitments: CommitmentItem[];
  tabCounts: { stories: number; messages: number; meetings: number };
  alertText?: string;
}

// ── SVG gauge constants (spec: 120px, r=50, stroke 8, circumference ≈ 314) ──

const GAUGE_VIEW = 120; // SVG width/height
const GAUGE_CX = 60; // Center x
const GAUGE_CY = 60; // Center y
const GAUGE_R = 50; // Arc radius
const GAUGE_STROKE = 8; // Ring thickness
// Full circle length = 2πr — used for strokeDasharray second number (314 in spec)
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;

/** Arc visible length for score 0–100 — e.g. 87 → ~272px dash (spec example) */
function scoreArcDash(score: number): number {
  return (score / 100) * GAUGE_CIRCUMFERENCE;
}

// ── Mock data when API is unavailable ────────────────────────

const mockClients: Record<string, ClientData> = {
  techcorp: {
    id: "techcorp",
    name: "TechCorp Ltd",
    initials: "TC",
    industry: "IT Services",
    platform: "Platform V2",
    since: "Since Jan 2024",
    contractValue: "Rs 85L per year",
    healthScore: 87,
    scoreDelta: "↑ 6 points this week",
    status: "healthy",
    statusLabel: "Healthy",
    stats: [
      { label: "Response Time", value: "1.2 hrs" },
      { label: "On-time Delivery", value: "94%" },
      { label: "Open Issues", value: "3" },
      { label: "Sprint Completion", value: "91%" },
    ],
    scoreHistory: [71, 68, 74, 80, 77, 83, 81, 87],
    issueBreakdown: [
      { label: "Bugs Raised", count: 12, fillColor: colors.danger },
      { label: "Changes", count: 8, fillColor: colors["brand-blue"] },
      { label: "Features", count: 5, fillColor: colors["success-dark"] },
    ],
    messages: [
      {
        id: "m1",
        text: "Dashboard loading slow again — go-live is Friday",
        storyLink: "Story #445 created",
      },
      {
        id: "m2",
        text: "Export button broken in UAT environment",
        storyLink: "Story #446 created",
      },
      {
        id: "m3",
        text: "Can we get mobile view in next sprint?",
        storyLink: "Story #447 created",
      },
    ],
    sprintName: "Sprint 14 in progress",
    sprintProgress: 68,
    sprintEnds: "Ends Friday 25 May",
    commitments: [
      { id: "c1", text: "Fix dashboard by Thursday", status: "open" },
      { id: "c2", text: "Send estimates by EOD", status: "done" },
    ],
    tabCounts: { stories: 47, messages: 24, meetings: 8 },
  },
  startupxyz: {
    id: "startupxyz",
    name: "StartupXYZ",
    initials: "SX",
    industry: "SaaS",
    platform: "Platform V1",
    since: "Since Mar 2023",
    contractValue: "Rs 42L per year",
    healthScore: 43,
    scoreDelta: "↓ 28 points in 72 hours",
    status: "critical",
    statusLabel: "At Risk",
    stats: [
      { label: "Response Time", value: "4.8 hrs" },
      { label: "On-time Delivery", value: "62%" },
      { label: "Open Issues", value: "11" },
      { label: "Sprint Completion", value: "54%" },
    ],
    scoreHistory: [71, 68, 62, 58, 52, 48, 45, 43],
    issueBreakdown: [
      { label: "Bugs Raised", count: 18, fillColor: colors.danger },
      { label: "Changes", count: 6, fillColor: colors["brand-blue"] },
      { label: "Features", count: 2, fillColor: colors["success-dark"] },
    ],
    messages: [
      { id: "m1", text: "SSO redirect loop still not fixed" },
      { id: "m2", text: "Need escalation on overdue stories" },
      { id: "m3", text: "Client threatening SLA breach" },
    ],
    sprintName: "Sprint 11 in progress",
    sprintProgress: 34,
    sprintEnds: "Ends Thursday 24 May",
    commitments: [
      { id: "c1", text: "Resolve SSO by Wednesday", status: "open" },
      { id: "c2", text: "Weekly status call", status: "open" },
    ],
    tabCounts: { stories: 22, messages: 18, meetings: 5 },
    alertText: "SLA Breach Risk — 8 messages unacknowledged",
  },
};

function getMockClient(clientId: string): ClientData {
  return mockClients[clientId.toLowerCase()] ?? mockClients.techcorp;
}

// ── Page ─────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id: clientId = "techcorp" } = useParams<{ id: string }>();

  // activeTab — Overview | Stories | Messages | Meetings | Reports
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  // clientData — payload from GET /api/clients/:clientId
  const [clientData, setClientData] = useState<ClientData | null>(null);
  // isLoading — true until fetch completes
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getClientById<ClientData>(clientId);
        if (!cancelled) setClientData(data);
      } catch {
        if (!cancelled) setClientData(getMockClient(clientId));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (isLoading && !clientData) {
    return (
      <AppShell pageTitle="Clients">
        <p style={{ color: colors["text-secondary"], fontSize: typography.bodySm.size }}>
          Loading client health…
        </p>
      </AppShell>
    );
  }

  const data = clientData ?? getMockClient(clientId);
  const isCritical = data.status === "critical";
  const gaugeStroke = isCritical ? colors.danger : colors.success;
  const arcLen = scoreArcDash(data.healthScore);

  return (
    <AppShell pageTitle="Clients">
      {/* BREADCRUMB — Dashboard > Clients > name */}
      <nav
        style={{
          marginBottom: spacing[4],
          fontSize: typography.captionMd.size,
          color: colors["text-tertiary"],
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          flexWrap: "wrap",
        }}
        aria-label="Breadcrumb"
      >
        <Link to="/dashboard" style={breadcrumbLink}>
          Dashboard
        </Link>
        <span aria-hidden>{">"}</span>
        <Link to="/clients" style={breadcrumbLink}>
          Clients
        </Link>
        <span aria-hidden>{">"}</span>
        <span style={{ color: colors["text-secondary"] }}>{data.name}</span>
      </nav>

      {/* HERO CARD */}
      <div
        style={{
          backgroundColor: colors["surface-card"],
          border: `1px solid ${colors["border-default"]}`,
          borderLeft: isCritical
            ? `4px solid ${colors.danger}`
            : `1px solid ${colors["border-default"]}`,
          borderRadius: borderRadius.xl,
          padding: "28px",
          marginBottom: spacing[5],
          display: "flex",
          gap: "32px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* LEFT — identity + gauge */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: borderRadius.full,
              backgroundColor: colors["info-bg"],
              color: "#1e40af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            {data.initials}
          </div>
          <h1
            style={{
              margin: "10px 0 0",
              fontSize: typography.displayMd.size,
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            {data.name}
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[2],
              marginTop: "6px",
            }}
          >
            {[data.industry, data.platform, data.since].map((tag) => (
              <span key={tag} style={tagPill}>
                {tag}
              </span>
            ))}
          </div>
          <div
            style={{
              marginTop: spacing[2],
              fontSize: typography.titleMd.size,
              fontWeight: 700,
              color: colors["success-dark"],
            }}
          >
            {data.contractValue}
          </div>

          {/* HEALTH GAUGE — flex row: SVG + trend text */}
          <div
            style={{
              marginTop: spacing[4],
              display: "flex",
              alignItems: "center",
              gap: spacing[4],
            }}
          >
            <div style={{ textAlign: "center" }}>
              <svg width={GAUGE_VIEW} height={GAUGE_VIEW} aria-label={`Health score ${data.healthScore}`}>
                {/* Background track */}
                <circle
                  cx={GAUGE_CX}
                  cy={GAUGE_CY}
                  r={GAUGE_R}
                  fill="none"
                  stroke={colors["border-default"]}
                  strokeWidth={GAUGE_STROKE}
                />
                {/* Score arc — dasharray = visible arc + gap (272 + 314 in spec at score 87) */}
                <circle
                  cx={GAUGE_CX}
                  cy={GAUGE_CY}
                  r={GAUGE_R}
                  fill="none"
                  stroke={gaugeStroke}
                  strokeWidth={GAUGE_STROKE}
                  strokeDasharray={`${arcLen} ${GAUGE_CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
                />
                <text
                  x={GAUGE_CX}
                  y={GAUGE_CY - 4}
                  textAnchor="middle"
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    fill: isCritical ? colors.danger : colors["text-primary"],
                  }}
                >
                  {data.healthScore}
                </text>
                <text
                  x={GAUGE_CX}
                  y={GAUGE_CY + 18}
                  textAnchor="middle"
                  style={{
                    fontSize: typography.captionMd.size,
                    fontWeight: 600,
                    fill: isCritical ? colors.danger : colors["success-dark"],
                  }}
                >
                  {data.statusLabel}
                </text>
              </svg>
            </div>
            <div
              style={{
                fontSize: typography.captionSm.size,
                color: isCritical ? colors.danger : colors["success-dark"],
                fontWeight: 500,
              }}
            >
              {data.scoreDelta}
            </div>
          </div>
        </div>

        {/* RIGHT — 2×2 stats + actions */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: spacing[3],
            }}
          >
            {data.stats.map((stat) => (
              <div key={stat.label} style={miniStatBox}>
                <div
                  style={{
                    fontSize: typography.tableHeader.size,
                    color: colors["text-tertiary"],
                    marginBottom: spacing[1],
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: typography.titleMd.size,
                    fontWeight: 700,
                    color: colors["text-primary"],
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: spacing[4],
              display: "flex",
              gap: spacing[2],
            }}
          >
            <button
              type="button"
              className="dp-btn dp-btn-primary dp-btn--compact"
              style={{ flex: 1 }}
            >
              Send Status Update
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-outline-brand dp-btn--compact"
              style={{ flex: 1 }}
            >
              Schedule Meeting
            </button>
          </div>
        </div>
      </div>

      {/* CRITICAL ALERT BANNER */}
      {isCritical && data.alertText && (
        <div style={alertBannerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
            <AlertTriangle size={18} color={colors.danger} aria-hidden />
            <span
              style={{
                fontSize: typography.captionMd.size,
                color: colors["text-primary"],
              }}
            >
              {data.alertText}
            </span>
          </div>
          <button type="button" className="dp-btn-danger" style={{ marginLeft: "auto" }}>
            Call Client Now
          </button>
        </div>
      )}

      {/* TABS */}
      <div
        style={{
          borderBottom: `1px solid ${colors["border-default"]}`,
          marginBottom: spacing[5],
          display: "flex",
          gap: spacing[6],
          flexWrap: "wrap",
        }}
      >
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "stories", label: `Stories ${data.tabCounts.stories}` },
            { id: "messages", label: `Messages ${data.tabCounts.messages}` },
            { id: "meetings", label: `Meetings ${data.tabCounts.meetings}` },
            { id: "reports", label: "Reports" },
          ] as { id: DetailTab; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`dp-tab ${active ? "dp-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: spacing[5],
            alignItems: "start",
          }}
        >
          <div>
            <div style={cardStyle}>
              <h2 style={cardTitle}>Health Score History</h2>
              <ScoreHistoryChart points={data.scoreHistory} />
            </div>
            <div style={{ ...cardStyle, marginTop: spacing[4] }}>
              <h2 style={cardTitle}>Issue Breakdown</h2>
              {data.issueBreakdown.map((row) => (
                <IssueBarRow
                  key={row.label}
                  row={row}
                  maxCount={Math.max(...data.issueBreakdown.map((r) => r.count))}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            <div style={{ ...cardStyle, padding: spacing[4] }}>
              <h3 style={sidebarCardTitle}>Latest Messages</h3>
              {data.messages.map((msg, i) => (
                <div
                  key={msg.id}
                  style={{
                    padding: `${spacing[2]} 0`,
                    borderBottom:
                      i < data.messages.length - 1
                        ? `1px solid ${colors["border-default"]}`
                        : "none",
                  }}
                >
                  <p
                    style={{
                      margin: `0 0 ${spacing[1]}`,
                      fontSize: typography.captionSm.size,
                      color: colors["text-primary"],
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {msg.text}
                  </p>
                  {msg.storyLink && (
                    <button type="button" style={storyLinkBtn}>
                      {msg.storyLink}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle, padding: spacing[4] }}>
              <h3
                style={{
                  margin: `0 0 ${spacing[3]}`,
                  fontSize: typography.captionMd.size,
                  fontWeight: 700,
                  color: colors["text-primary"],
                }}
              >
                {data.sprintName}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
                <SprintRing progress={data.sprintProgress} />
                <span
                  style={{
                    fontSize: typography.tableHeader.size,
                    color: colors["text-tertiary"],
                  }}
                >
                  {data.sprintEnds}
                </span>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: spacing[4] }}>
              <h3 style={sidebarCardTitle}>Open Commitments</h3>
              {data.commitments.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: spacing[2],
                    padding: `${spacing[2]} 0`,
                    borderBottom:
                      i < data.commitments.length - 1
                        ? `1px solid ${colors["border-default"]}`
                        : "none",
                  }}
                >
                  <span style={{ fontSize: typography.captionSm.size }}>{c.text}</span>
                  <StatusBadge
                    variant={c.status === "done" ? "healthy" : "at-risk"}
                    label={c.status === "done" ? "Done" : "Open"}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab !== "overview" && (
        <div style={{ ...cardStyle, color: colors["text-secondary"] }}>
          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} content for {data.name}{" "}
          — connect when API is ready.
        </div>
      )}
    </AppShell>
  );
}

// ── Health history chart (polyline + fill) ───────────────────

function ScoreHistoryChart({ points }: { points: number[] }) {
  const width = 600;
  const height = 180;
  const pad = 20;
  const min = Math.min(...points) - 4;
  const max = Math.max(...points) + 4;
  const xStep = (width - pad * 2) / (points.length - 1);

  const linePts = points
    .map((p, i) => {
      const x = pad + i * xStep;
      const y = pad + ((max - p) / (max - min)) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPts = `${pad},${height - pad} ${linePts} ${pad + (points.length - 1) * xStep},${height - pad}`;

  return (
    <div
      style={{
        backgroundColor: colors["surface-subtle"],
        borderRadius: borderRadius.sm,
        height: 180,
        overflow: "hidden",
      }}
    >
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polygon points={areaPts} fill="rgba(0, 136, 255, 0.08)" />
        <polyline
          points={linePts}
          fill="none"
          stroke={colors["brand-blue"]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ── Issue breakdown bar row ──────────────────────────────────

function IssueBarRow({
  row,
  maxCount,
}: {
  row: IssueRow;
  maxCount: number;
}) {
  const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        height: 32,
        marginBottom: spacing[2],
      }}
    >
      <span
        style={{
          width: 80,
          flexShrink: 0,
          fontSize: typography.captionSm.size,
          color: colors["text-secondary"],
        }}
      >
        {row.label}
      </span>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: borderRadius.full,
          backgroundColor: colors.canvas,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: row.fillColor,
            borderRadius: borderRadius.full,
          }}
        />
      </div>
      <span
        style={{
          width: 30,
          textAlign: "right",
          fontSize: typography.captionSm.size,
          fontWeight: 700,
          color: colors["text-primary"],
        }}
      >
        {row.count}
      </span>
    </div>
  );
}

// ── Sprint progress ring (60px) ──────────────────────────────

function SprintRing({ progress }: { progress: number }) {
  const size = 60;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (progress / 100) * circ;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={colors.canvas}
          stroke="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors["border-default"]}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors["brand-blue"]}
          strokeWidth={stroke}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: typography.tableHeader.size,
          fontWeight: 700,
          color: colors["brand-blue"],
        }}
      >
        {progress}%
      </span>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────

const breadcrumbLink: CSSProperties = {
  color: colors["text-tertiary"],
  textDecoration: "none",
};

const tagPill: CSSProperties = {
  backgroundColor: colors.canvas,
  color: colors["text-secondary"],
  fontSize: typography.captionSm.size,
  padding: "3px 10px",
  borderRadius: borderRadius.full,
};

const miniStatBox: CSSProperties = {
  backgroundColor: colors["surface-subtle"],
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  padding: spacing[3],
};

const alertBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[4],
  flexWrap: "wrap",
  width: "100%",
  backgroundColor: colors["danger-bg"],
  borderBottom: "1px solid #fca5a5",
  padding: "12px 20px",
  marginBottom: spacing[4],
};

const cardStyle: CSSProperties = {
  backgroundColor: colors["surface-card"],
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  padding: spacing[5],
};

const cardTitle: CSSProperties = {
  margin: `0 0 ${spacing[3]} 0`,
  fontSize: typography.bodyLg.size,
  fontWeight: 600,
  color: colors["text-primary"],
};

const sidebarCardTitle: CSSProperties = {
  margin: `0 0 10px 0`,
  fontSize: typography.listTitle.size,
  fontWeight: 600,
  color: colors["text-primary"],
};

const storyLinkBtn: CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  fontSize: typography.tableHeader.size,
  fontWeight: 600,
  color: colors["brand-blue"],
  cursor: "pointer",
};
