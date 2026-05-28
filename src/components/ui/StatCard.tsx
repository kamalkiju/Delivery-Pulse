// ─────────────────────────────────────────────
// StatCard — dashboard KPI card (Figma stat-card component)
// Used in a 4-up grid on the Dashboard page
// ─────────────────────────────────────────────

import type { ReactNode } from "react";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

export interface StatCardProps {
  /** Short descriptor under the icon, e.g. "Active clients" — 12px Medium, #64748b */
  label: string;
  /** Main KPI number or text, e.g. 12 or "74" — 32px Bold, #1e293b */
  value: string | number;
  /** Optional secondary line, e.g. "↑ 6 from last week" — 12px Regular */
  trend?: string;
  /** Optional color for trend text; defaults to #94a3b8 (text-tertiary) */
  trendColor?: string;
  /** Optional icon node (Lucide component, emoji, or image) inside the 36×36 icon box */
  icon?: ReactNode;
  /** Optional background for the icon box, e.g. "#dbeafe" */
  iconBgColor?: string;
  /** Optional 3px left accent border for critical cards, e.g. "#dc2626" */
  borderLeftColor?: string;
}

const StatCard = ({
  label, // Required — card title, e.g. "Active clients"
  value, // Required — KPI number or string shown large, e.g. 12
  trend, // Optional — helper line under the value, e.g. "↑ 6 from last week"
  trendColor, // Optional — trend text color; defaults to #94a3b8
  icon, // Optional — React node rendered inside the 36×36 icon box
  iconBgColor, // Optional — icon box background, e.g. "#dbeafe"
  borderLeftColor, // Optional — 3px left border for critical cards, e.g. "#dc2626"
}: StatCardProps) => {
  const defaultBorder = `1px solid ${colors["border-default"]}`;

  return (
    <div
      data-name="stat-card"
      style={{
        backgroundColor: colors["surface-card"],
        borderRadius: borderRadius.md,
        padding: spacing[5],
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        boxSizing: "border-box",
        borderTop: defaultBorder,
        borderRight: defaultBorder,
        borderBottom: defaultBorder,
        borderLeft: borderLeftColor
          ? `3px solid ${borderLeftColor}`
          : defaultBorder,
      }}
    >
      {icon != null && (
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: borderRadius.md,
            backgroundColor: iconBgColor ?? colors.canvas,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: colors["text-secondary"],
            flexShrink: 0,
          }}
          aria-hidden
        >
          {icon}
        </div>
      )}

      <span
        style={{
          fontSize: typography.captionMd.size,
          fontWeight: typography.captionMd.weight,
          color: colors["text-secondary"],
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: typography.displayLg.size,
          fontWeight: typography.displayLg.weight,
          color: colors["text-primary"],
          lineHeight: 1,
        }}
      >
        {value}
      </span>

      {trend != null && trend !== "" && (
        <span
          style={{
            fontSize: typography.captionSm.size,
            fontWeight: typography.captionSm.weight,
            color: trendColor ?? colors["text-secondary"],
            lineHeight: 1.3,
          }}
        >
          {trend}
        </span>
      )}
    </div>
  );
};

export default StatCard;

// ─────────────────────────────────────────────
// Usage examples (Dashboard 4-up grid)
// ─────────────────────────────────────────────
//
// import StatCard from "./components/ui/StatCard";
// import { Users } from "lucide-react";
//
// // 1) Basic KPI — label, value, trend
// <StatCard
//   label="Active clients"
//   value={12}
//   trend="2 at risk · 1 critical"
//   trendColor="#dc2626"
// />
//
// // 2) With icon box
// <StatCard
//   label="Stories this week"
//   value={47}
//   trend="34 auto-created by AI"
//   trendColor="#7c3aed"
//   icon={<Users size={18} />}
//   iconBgColor="#dbeafe"
// />
//
// // 3) Positive trend (green)
// <StatCard
//   label="Avg health score"
//   value={74}
//   trend="↑ 6 from last week"
//   trendColor="#16a34a"
// />
//
// // 4) Critical card — red left border accent
// <StatCard
//   label="SLA at risk"
//   value={3}
//   trend="Action needed today"
//   trendColor="#dc2626"
//   borderLeftColor="#dc2626"
// />
