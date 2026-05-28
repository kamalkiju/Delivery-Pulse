// ─────────────────────────────────────────────
// ReportsPage — Reports & Analytics dashboard
// Figma: DeliveryPulse (node 82:1091)
// ─────────────────────────────────────────────

import { useMemo, useState, type CSSProperties } from "react";
import { exportReport } from "../../api/reports.api";
import AppShell from "../../components/layout/AppShell";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import { borderRadius, colors, spacing, typography } from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

type DateRange = "last-30-days" | "last-7-days" | "this-quarter";

interface ClientRow {
  client: string;
  healthScore: number;
  stories: number;
  avgResponse: string;
  delivery: string;
  trend: "up" | "down" | "flat";
  status: "Healthy" | "At Risk" | "Critical";
}

// Spec accent colors (not all in tokens)
const PURPLE = "#7c3aed";
const TEAL = "#0f766e";

// ── Chart / table data ───────────────────────────────────────

const weeklyLabels = [
  "Apr 07",
  "Apr 14",
  "Apr 21",
  "Apr 28",
  "May 05",
  "May 12",
  "May 19",
  "May 26",
];

const aiCreatedByWeek = [12, 18, 16, 22, 20, 26, 24, 30];
const manualCreatedByWeek = [6, 7, 8, 9, 8, 10, 9, 11];

const sourceBreakdown = [
  { label: "Slack", value: 45, color: colors["brand-blue"] },
  { label: "Documents", value: 32, color: PURPLE },
  { label: "Meetings", value: 15, color: TEAL },
  { label: "Manual", value: 8, color: "#94a3b8" },
];

const clientRows: ClientRow[] = [
  { client: "TechCorp", healthScore: 87, stories: 34, avgResponse: "1.2h", delivery: "94%", trend: "up", status: "Healthy" },
  { client: "GlobalRetail", healthScore: 61, stories: 18, avgResponse: "3.4h", delivery: "78%", trend: "down", status: "At Risk" },
  { client: "StartupXYZ", healthScore: 43, stories: 12, avgResponse: "6.1h", delivery: "65%", trend: "down", status: "Critical" },
  { client: "FinanceApp", healthScore: 79, stories: 21, avgResponse: "2.1h", delivery: "88%", trend: "flat", status: "Healthy" },
  { client: "MegaCorp", healthScore: 55, stories: 8, avgResponse: "4.8h", delivery: "71%", trend: "up", status: "At Risk" },
  { client: "DevHouse", healthScore: 91, stories: 41, avgResponse: "0.8h", delivery: "96%", trend: "up", status: "Healthy" },
];

// Sprint delivery % per week — spec values
const sprintDeliveryRate = [88, 82, 91, 76, 85, 73, 89, 87];

// ── SVG helpers ──────────────────────────────────────────────

/** Map weekly values to SVG polyline `points` (y: 0–30 scale) */
function toPolylinePoints(
  values: number[],
  w: number,
  h: number,
  pad: number,
  yMax = 30,
): string {
  const xStep = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * xStep;
      const y = pad + ((yMax - v) / yMax) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

/**
 * Donut segments via stroke-dasharray on circles.
 * radius 50, strokeWidth 20 per spec; circumference = 2πr.
 */
function donutSegments(
  segments: { value: number; color: string; label: string }[],
  radius = 50,
) {
  const circumference = 2 * Math.PI * radius;
  const gap = 4;
  let offset = 0;

  return segments.map((seg) => {
    const segLen = (seg.value / 100) * circumference;
    const dashArray = `${Math.max(segLen - gap, 0)} ${circumference}`;
    const dashOffset = -offset;
    offset += segLen;
    return {
      stroke: seg.color,
      dashArray,
      dashOffset,
      label: seg.label,
      value: seg.value,
    };
  });
}

function statusVariant(
  status: ClientRow["status"],
): "healthy" | "at-risk" | "critical" {
  if (status === "Healthy") return "healthy";
  if (status === "At Risk") return "at-risk";
  return "critical";
}

function trendArrow(trend: ClientRow["trend"]): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

function trendColor(trend: ClientRow["trend"]): string {
  if (trend === "up") return colors["success-dark"];
  if (trend === "down") return colors.danger;
  return colors["text-tertiary"];
}

function healthScoreColors(score: number): { bg: string; fg: string } {
  if (score >= 80) return { bg: "rgba(16,185,129,0.10)", fg: colors["success-dark"] };
  if (score >= 60) return { bg: "rgba(245,158,11,0.12)", fg: colors["warning-dark"] };
  return { bg: "rgba(220,38,38,0.10)", fg: colors.danger };
}

/** Bar fill: green ≥85%, amber 70–84%, red <70% */
function sprintBarColor(value: number): string {
  if (value >= 85) return colors["success-dark"];
  if (value >= 70) return colors["warning-dark"];
  return colors.danger;
}

// ── Page ─────────────────────────────────────────────────────

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("last-30-days");
  const [isExporting, setIsExporting] = useState(false);

  const dropdownLabel = useMemo(() => {
    if (dateRange === "last-7-days") return "Last 7 days";
    if (dateRange === "this-quarter") return "This quarter";
    return "Last 30 days";
  }, [dateRange]);

  const chartW = 520;
  const chartH = 170;
  const chartPad = 24;

  const aiPoints = useMemo(
    () => toPolylinePoints(aiCreatedByWeek, chartW, chartH, chartPad),
    [],
  );
  const manualPoints = useMemo(
    () => toPolylinePoints(manualCreatedByWeek, chartW, chartH, chartPad),
    [],
  );

  const donut = useMemo(() => donutSegments(sourceBreakdown, 50), []);

  const handleExport = async (kind: "pdf" | "excel") => {
    setIsExporting(true);
    try {
      const blob = await exportReport(kind);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delivery-pulse-report.${kind === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.warn(`Export ${kind} failed — backend may be offline`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell pageTitle="Reports">
      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing[6],
          gap: spacing[4],
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: typography.titleXl.size,
            fontWeight: 700,
            color: colors["text-primary"],
          }}
        >
          Reports & Analytics
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() =>
              setDateRange((p) =>
                p === "last-30-days"
                  ? "last-7-days"
                  : p === "last-7-days"
                    ? "this-quarter"
                    : "last-30-days",
              )
            }
            style={dropdownBtn}
          >
            {dropdownLabel} ▼
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExport("pdf")}
            style={{ ...ghostBtn, opacity: isExporting ? 0.6 : 1 }}
          >
            Export PDF
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExport("excel")}
            style={{ ...ghostBtn, opacity: isExporting ? 0.6 : 1 }}
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* KPI ROW — 5 StatCards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: spacing[4],
          marginBottom: spacing[6],
        }}
      >
        <StatCard
          label="Total Stories"
          value={127}
          trend="↑ 23% vs last month"
          trendColor={colors["success-dark"]}
        />
        <StatCard
          label="AI Auto-created"
          value={94}
          trend="74% of all stories"
          trendColor={PURPLE}
        />
        <StatCard
          label="Avg Response"
          value="18 min"
          trend="↓ 6 min improvement"
          trendColor={colors["success-dark"]}
        />
        <StatCard
          label="Sprint Delivery"
          value="87%"
          trend="On track"
          trendColor={colors["success-dark"]}
        />
        <StatCard
          label="Revenue Protected"
          value="Rs 4.2Cr"
          trend="2 churns prevented"
          trendColor={colors["brand-blue"]}
        />
      </div>

      {/* CHART ROW 1 — 60% / 38% */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60% 38%",
          gap: spacing[4],
          marginBottom: spacing[5],
        }}
      >
        {/* Stories Over Time */}
        <div style={card}>
          <h2 style={cardTitle}>Stories Created Over Time</h2>
          <div
            style={{
              height: 200,
              backgroundColor: colors["surface-subtle"],
              borderRadius: borderRadius.sm,
              position: "relative",
              padding: spacing[3],
            }}
          >
            <svg
              width="100%"
              height={170}
              viewBox={`0 0 ${chartW} ${chartH}`}
              preserveAspectRatio="none"
              style={{ display: "block" }}
            >
              {/* 4 horizontal grid lines (y at 0, 10, 20, 30) */}
              {[0, 10, 20, 30].map((tick) => {
                const y =
                  chartPad + ((30 - tick) / 30) * (chartH - chartPad * 2);
                return (
                  <line
                    key={tick}
                    x1={chartPad}
                    y1={y}
                    x2={chartW - chartPad}
                    y2={y}
                    stroke={colors["border-default"]}
                    strokeWidth={1}
                  />
                );
              })}
              <polyline
                points={aiPoints}
                fill="none"
                stroke={colors["brand-blue"]}
                strokeWidth={2}
              />
              <polyline
                points={manualPoints}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                left: spacing[3],
                right: spacing[3],
                bottom: 6,
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10px",
                color: colors["text-tertiary"],
              }}
            >
              {weeklyLabels.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </div>
          <div
            style={{
              marginTop: spacing[2],
              display: "flex",
              gap: spacing[4],
            }}
          >
            <LegendDot color={colors["brand-blue"]} label="AI Created" />
            <LegendDot color="#94a3b8" label="Manual" />
          </div>
        </div>

        {/* Source Breakdown donut */}
        <div style={card}>
          <h2 style={cardTitle}>Source Breakdown</h2>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <svg width={140} height={140} viewBox="0 0 140 140">
              <circle
                cx={70}
                cy={70}
                r={50}
                fill="none"
                stroke={colors["border-default"]}
                strokeWidth={20}
              />
              {donut.map((seg) => (
                <circle
                  key={seg.label}
                  cx={70}
                  cy={70}
                  r={50}
                  fill="none"
                  stroke={seg.stroke}
                  strokeWidth={20}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                />
              ))}
              <circle cx={70} cy={70} r={38} fill={colors["surface-card"]} />
            </svg>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: spacing[2],
              marginTop: spacing[3],
            }}
          >
            {sourceBreakdown.map((s) => (
              <div
                key={s.label}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: borderRadius.full,
                    backgroundColor: s.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: typography.captionSm.size,
                    color: colors["text-secondary"],
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: typography.captionSm.size,
                    fontWeight: 700,
                    color: colors["text-primary"],
                  }}
                >
                  {s.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CLIENT TABLE */}
      <div
        style={{
          ...card,
          padding: 0,
          marginBottom: spacing[5],
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${colors["border-default"]}`,
          }}
        >
          <span
            style={{
              fontSize: typography.bodyLg.size,
              fontWeight: 600,
              color: colors["text-primary"],
            }}
          >
            Client Health Summary
          </span>
          <span
            style={{
              fontSize: typography.captionSm.size,
              color: colors["text-tertiary"],
            }}
          >
            {dropdownLabel}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 90px 80px 110px 90px 70px 110px",
            padding: "10px 20px",
            backgroundColor: colors["surface-subtle"],
            borderBottom: `1px solid ${colors["border-default"]}`,
            columnGap: spacing[3],
          }}
        >
          {["CLIENT", "HEALTH", "STORIES", "AVG RESPONSE", "DELIVERY", "TREND", "STATUS"].map(
            (col) => (
              <span key={col} style={tableHeader}>
                {col}
              </span>
            ),
          )}
        </div>

        {clientRows.map((row) => {
          const isCriticalRow = row.client === "StartupXYZ";
          const scoreStyle = healthScoreColors(row.healthScore);

          return (
            <div
              key={row.client}
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 90px 80px 110px 90px 70px 110px",
                alignItems: "center",
                height: 52,
                padding: "0 20px",
                columnGap: spacing[3],
                borderBottom: `1px solid ${colors["border-default"]}`,
                backgroundColor: isCriticalRow
                  ? "rgba(220, 38, 38, 0.04)"
                  : colors["surface-card"],
                borderLeft: isCriticalRow
                  ? `3px solid ${colors.danger}`
                  : "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!isCriticalRow) {
                  e.currentTarget.style.backgroundColor = colors["surface-subtle"];
                }
              }}
              onMouseLeave={(e) => {
                if (!isCriticalRow) {
                  e.currentTarget.style.backgroundColor = colors["surface-card"];
                }
              }}
            >
              <span
                style={{
                  fontSize: typography.bodySm.size,
                  fontWeight: 600,
                  color: colors["text-primary"],
                }}
              >
                {row.client}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  padding: "2px 10px",
                  borderRadius: borderRadius.full,
                  backgroundColor: scoreStyle.bg,
                  color: scoreStyle.fg,
                  fontSize: typography.captionSm.size,
                  fontWeight: 700,
                  width: "fit-content",
                }}
              >
                {row.healthScore}
              </span>
              <span style={cellText}>{row.stories}</span>
              <span style={cellText}>{row.avgResponse}</span>
              <span style={{ ...cellText, fontWeight: 600, color: colors["text-primary"] }}>
                {row.delivery}
              </span>
              <span
                style={{
                  fontSize: typography.bodySm.size,
                  fontWeight: 700,
                  color: trendColor(row.trend),
                }}
              >
                {trendArrow(row.trend)}
              </span>
              <StatusBadge variant={statusVariant(row.status)} label={row.status} />
            </div>
          );
        })}
      </div>

      {/* CHART ROW 2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing[4],
        }}
      >
        <div style={card}>
          <h2 style={cardTitle}>Sprint Delivery Rate</h2>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: spacing[2],
              height: 150,
              marginTop: spacing[4],
            }}
          >
            {sprintDeliveryRate.map((v, i) => (
              <div
                key={weeklyLabels[i]}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${(v / 100) * 120}px`,
                    backgroundColor: sprintBarColor(v),
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <span
                  style={{
                    marginTop: spacing[2],
                    fontSize: "10px",
                    color: colors["text-tertiary"],
                  }}
                >
                  {weeklyLabels[i].slice(0, 6)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>BA Time Saved with AI</h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: spacing[2],
            }}
          >
            <span style={baLabel}>Before AI</span>
            <div
              style={{
                flex: 1,
                height: 12,
                borderRadius: borderRadius.full,
                backgroundColor: "#fecaca",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={baLabel}>After AI</span>
            <div
              style={{
                flex: 1,
                height: 12,
                borderRadius: borderRadius.full,
                backgroundColor: colors["border-default"],
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "18%",
                  height: "100%",
                  backgroundColor: "#86efac",
                  borderRadius: borderRadius.full,
                }}
              />
            </div>
          </div>
          <div
            style={{
              marginTop: spacing[4],
              textAlign: "center",
              fontSize: typography.titleXl.size,
              fontWeight: 700,
              color: colors["success-dark"],
            }}
          >
            3h 15min saved per day
          </div>
          <p
            style={{
              margin: `${spacing[1]} 0 0`,
              textAlign: "center",
              fontSize: typography.captionMd.size,
              color: colors["text-secondary"],
            }}
          >
            65 hours per month · Rs 2.1L saved annually
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: borderRadius.full,
          backgroundColor: color,
        }}
      />
      <span
        style={{
          fontSize: typography.captionSm.size,
          color: colors["text-secondary"],
        }}
      >
        {label}
      </span>
    </span>
  );
}

const dropdownBtn: CSSProperties = {
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  padding: "8px 12px",
  fontSize: typography.captionMd.size,
  color: colors["text-secondary"],
  backgroundColor: colors["surface-card"],
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  padding: "8px 14px",
  fontSize: typography.captionSm.size,
  color: colors["text-secondary"],
  backgroundColor: "transparent",
  cursor: "pointer",
};

const card: CSSProperties = {
  backgroundColor: colors["surface-card"],
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  padding: spacing[5],
  boxSizing: "border-box",
};

const cardTitle: CSSProperties = {
  margin: `0 0 14px 0`,
  fontSize: typography.bodyLg.size,
  fontWeight: 600,
  color: colors["text-primary"],
};

const tableHeader: CSSProperties = {
  fontSize: typography.tableHeader.size,
  fontWeight: 600,
  color: colors["text-tertiary"],
  textTransform: "uppercase",
};

const cellText: CSSProperties = {
  fontSize: typography.bodySm.size,
  color: colors["text-secondary"],
};

const baLabel: CSSProperties = {
  width: 70,
  flexShrink: 0,
  fontSize: typography.captionSm.size,
  color: colors["text-secondary"],
};
