// ─────────────────────────────────────────────
// ClientDetailPage — single-client health detail
// ─────────────────────────────────────────────

import { useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getClientById, type ClientDetail } from "../../api/clients.api";
import AppShell from "../../components/layout/AppShell";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

type DetailTab = "overview" | "stories" | "messages" | "meetings" | "reports";
type ClientStatus = "healthy" | "at-risk" | "critical";

// ── SVG gauge constants ──────────────────────────────────────

const GAUGE_VIEW = 120;
const GAUGE_CX = 60;
const GAUGE_CY = 60;
const GAUGE_R = 50;
const GAUGE_STROKE = 8;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;

function scoreArcDash(score: number): number {
  return (score / 100) * GAUGE_CIRCUMFERENCE;
}

// ── Helpers ──────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getScoreDelta(history: number[]): string {
  if (history.length < 2) return "No trend data yet";
  const diff = history[history.length - 1] - history[history.length - 2];
  if (diff === 0) return "No change this period";
  return diff > 0
    ? `↑ ${diff} points this period`
    : `↓ ${Math.abs(diff)} points this period`;
}

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  "at-risk": "At Risk",
  critical: "Critical",
};

// ── Page ─────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id: clientId = "" } = useParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getClientById(clientId)
      .then((data) => { if (!cancelled) setClient(data); })
      .catch(() => { if (!cancelled) setError("Could not load client. Please try again."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [clientId]);

  if (isLoading) {
    return (
      <AppShell pageTitle="Clients">
        <p style={{ color: colors["text-secondary"], fontSize: typography.bodySm.size }}>
          Loading client health…
        </p>
      </AppShell>
    );
  }

  if (error || !client) {
    return (
      <AppShell pageTitle="Clients">
        <p style={{ color: colors.danger, fontSize: typography.bodySm.size }}>
          {error ?? "Client not found."}
        </p>
      </AppShell>
    );
  }

  const status = client.status as ClientStatus;
  const isCritical = status === "critical";
  const gaugeStroke = isCritical ? colors.danger : colors.success;
  const arcLen = scoreArcDash(client.healthScore);
  const initials = getInitials(client.name);
  const scoreDelta = getScoreDelta(client.scoreHistory);
  const statusLabel = STATUS_LABEL[status] ?? status;

  const issueBreakdown = [
    { label: "Bugs Raised",  count: client.storyCounts.bugs,     fillColor: colors.danger },
    { label: "Changes",      count: client.storyCounts.changes,  fillColor: colors["brand-blue"] },
    { label: "Features",     count: client.storyCounts.features, fillColor: colors["success-dark"] },
  ];

  const stats = [
    { label: "Stories",      value: String(client.storyCounts.total) },
    { label: "Bugs",         value: String(client.storyCounts.bugs) },
    { label: "Meetings",     value: String(client.meetingCount) },
    { label: "Commitments",  value: String(client.commitments.length) },
  ];

  const tabCounts = {
    stories:  client.storyCounts.total,
    messages: client.recentMessages.length,
    meetings: client.meetingCount,
  };

  return (
    <AppShell pageTitle="Clients">
      {/* BREADCRUMB */}
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
        <Link to="/dashboard" style={breadcrumbLink}>Dashboard</Link>
        <span aria-hidden>{">"}</span>
        <Link to="/clients" style={breadcrumbLink}>Clients</Link>
        <span aria-hidden>{">"}</span>
        <span style={{ color: colors["text-secondary"] }}>{client.name}</span>
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
            {initials}
          </div>
          <h1
            style={{
              margin: "10px 0 0",
              fontSize: typography.displayMd.size,
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            {client.name}
          </h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[2],
              marginTop: "6px",
            }}
          >
            {[
              client.company,
              client.projectName || "No project",
              `Since ${new Date(client.createdAt).getFullYear()}`,
            ].map((tag) => (
              <span key={tag} style={tagPill}>{tag}</span>
            ))}
          </div>
          {client.contractValue && client.contractValue !== "—" && (
            <div
              style={{
                marginTop: spacing[2],
                fontSize: typography.titleMd.size,
                fontWeight: 700,
                color: colors["success-dark"],
              }}
            >
              {client.contractValue}
            </div>
          )}

          {/* HEALTH GAUGE */}
          <div
            style={{
              marginTop: spacing[4],
              display: "flex",
              alignItems: "center",
              gap: spacing[4],
            }}
          >
            <div style={{ textAlign: "center" }}>
              <svg width={GAUGE_VIEW} height={GAUGE_VIEW} aria-label={`Health score ${client.healthScore}`}>
                <circle cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none" stroke={colors["border-default"]} strokeWidth={GAUGE_STROKE} />
                <circle
                  cx={GAUGE_CX} cy={GAUGE_CY} r={GAUGE_R} fill="none"
                  stroke={gaugeStroke} strokeWidth={GAUGE_STROKE}
                  strokeDasharray={`${arcLen} ${GAUGE_CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
                />
                <text x={GAUGE_CX} y={GAUGE_CY - 4} textAnchor="middle"
                  style={{ fontSize: "28px", fontWeight: 700, fill: isCritical ? colors.danger : colors["text-primary"] }}>
                  {client.healthScore}
                </text>
                <text x={GAUGE_CX} y={GAUGE_CY + 18} textAnchor="middle"
                  style={{ fontSize: typography.captionMd.size, fontWeight: 600, fill: isCritical ? colors.danger : colors["success-dark"] }}>
                  {statusLabel}
                </text>
              </svg>
            </div>
            <div style={{ fontSize: typography.captionSm.size, color: isCritical ? colors.danger : colors["success-dark"], fontWeight: 500 }}>
              {scoreDelta}
            </div>
          </div>
        </div>

        {/* RIGHT — 2×2 stats + actions */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing[3] }}>
            {stats.map((stat) => (
              <div key={stat.label} style={miniStatBox}>
                <div style={{ fontSize: typography.tableHeader.size, color: colors["text-tertiary"], marginBottom: spacing[1] }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: typography.titleMd.size, fontWeight: 700, color: colors["text-primary"] }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: spacing[4], display: "flex", gap: spacing[2] }}>
            <button type="button" className="dp-btn dp-btn-primary dp-btn--compact" style={{ flex: 1 }}>
              Send Status Update
            </button>
            <button type="button" className="dp-btn dp-btn-outline-brand dp-btn--compact" style={{ flex: 1 }}>
              Schedule Meeting
            </button>
          </div>
        </div>
      </div>

      {/* CRITICAL ALERT BANNER */}
      {isCritical && (
        <div style={alertBannerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
            <AlertTriangle size={18} color={colors.danger} aria-hidden />
            <span style={{ fontSize: typography.captionMd.size, color: colors["text-primary"] }}>
              Client health critical — immediate attention required
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
            { id: "overview",  label: "Overview" },
            { id: "stories",   label: `Stories ${tabCounts.stories}` },
            { id: "messages",  label: `Messages ${tabCounts.messages}` },
            { id: "meetings",  label: `Meetings ${tabCounts.meetings}` },
            { id: "reports",   label: "Reports" },
          ] as { id: DetailTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`dp-tab ${activeTab === tab.id ? "dp-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
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
              <ScoreHistoryChart points={client.scoreHistory} />
            </div>
            <div style={{ ...cardStyle, marginTop: spacing[4] }}>
              <h2 style={cardTitle}>Issue Breakdown</h2>
              {issueBreakdown.map((row) => (
                <IssueBarRow
                  key={row.label}
                  row={row}
                  maxCount={Math.max(...issueBreakdown.map((r) => r.count), 1)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            <div style={{ ...cardStyle, padding: spacing[4] }}>
              <h3 style={sidebarCardTitle}>Latest Messages</h3>
              {client.recentMessages.length === 0 ? (
                <p style={{ margin: 0, fontSize: typography.captionSm.size, color: colors["text-secondary"] }}>
                  No messages yet.
                </p>
              ) : (
                client.recentMessages.map((msg, i) => (
                  <div
                    key={msg.id}
                    style={{
                      padding: `${spacing[2]} 0`,
                      borderBottom: i < client.recentMessages.length - 1
                        ? `1px solid ${colors["border-default"]}`
                        : "none",
                    }}
                  >
                    <p style={{ margin: `0 0 ${spacing[1]}`, fontSize: typography.captionSm.size, color: colors["text-primary"], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {msg.text}
                    </p>
                    {msg.aiProcessed && (
                      <button type="button" style={storyLinkBtn}>Story created</button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ ...cardStyle, padding: spacing[4] }}>
              <h3 style={{ margin: `0 0 ${spacing[3]}`, fontSize: typography.captionMd.size, fontWeight: 700, color: colors["text-primary"] }}>
                Sprint Progress
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: spacing[4] }}>
                <SprintRing progress={client.healthScore} />
                <span style={{ fontSize: typography.tableHeader.size, color: colors["text-tertiary"] }}>
                  {client.storyCounts.total} stories · {client.storyCounts.bugs} bugs open
                </span>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: spacing[4] }}>
              <h3 style={sidebarCardTitle}>Open Commitments</h3>
              {client.commitments.length === 0 ? (
                <p style={{ margin: 0, fontSize: typography.captionSm.size, color: colors["text-secondary"] }}>
                  No commitments logged yet.
                </p>
              ) : (
                client.commitments.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: spacing[2],
                      padding: `${spacing[2]} 0`,
                      borderBottom: i < client.commitments.length - 1
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab !== "overview" && (
        <div style={{ ...cardStyle, color: colors["text-secondary"] }}>
          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} content for {client.name} — coming soon.
        </div>
      )}
    </AppShell>
  );
}

// ── Health history chart ─────────────────────────────────────

function ScoreHistoryChart({ points }: { points: number[] }) {
  const width = 600;
  const height = 180;
  const pad = 20;
  const min = Math.min(...points) - 4;
  const max = Math.max(...points) + 4;
  const xStep = points.length > 1 ? (width - pad * 2) / (points.length - 1) : width - pad * 2;

  const linePts = points
    .map((p, i) => {
      const x = pad + i * xStep;
      const y = pad + ((max - p) / (max - min)) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPts = `${pad},${height - pad} ${linePts} ${pad + (points.length - 1) * xStep},${height - pad}`;

  return (
    <div style={{ backgroundColor: colors["surface-subtle"], borderRadius: borderRadius.sm, height: 180, overflow: "hidden" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polygon points={areaPts} fill="rgba(0, 136, 255, 0.08)" />
        <polyline points={linePts} fill="none" stroke={colors["brand-blue"]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ── Issue breakdown bar row ──────────────────────────────────

function IssueBarRow({ row, maxCount }: { row: { label: string; count: number; fillColor: string }; maxCount: number }) {
  const pct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing[3], height: 32, marginBottom: spacing[2] }}>
      <span style={{ width: 80, flexShrink: 0, fontSize: typography.captionSm.size, color: colors["text-secondary"] }}>
        {row.label}
      </span>
      <div style={{ flex: 1, height: 8, borderRadius: borderRadius.full, backgroundColor: colors.canvas, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: row.fillColor, borderRadius: borderRadius.full }} />
      </div>
      <span style={{ width: 30, textAlign: "right", fontSize: typography.captionSm.size, fontWeight: 700, color: colors["text-primary"] }}>
        {row.count}
      </span>
    </div>
  );
}

// ── Sprint progress ring ─────────────────────────────────────

function SprintRing({ progress }: { progress: number }) {
  const size = 60;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (progress / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={colors.canvas} stroke="none" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors["border-default"]} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors["brand-blue"]} strokeWidth={stroke}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: typography.tableHeader.size, fontWeight: 700, color: colors["brand-blue"] }}>
        {progress}%
      </span>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────

const breadcrumbLink: CSSProperties = { color: colors["text-tertiary"], textDecoration: "none" };

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
