// ─────────────────────────────────────────────
// StatusBadge — reusable pill badge for health / status labels
// Colors match DeliveryPulse Figma design system (status-badge component)
// ─────────────────────────────────────────────

import { borderRadius, typography } from "../../styles/tokens"; // Shared design tokens (radius, type scale)

// BadgeVariant — only these five values are allowed for the "variant" prop
export type BadgeVariant =
  | "healthy"
  | "at-risk"
  | "critical"
  | "info"
  | "pending";

// Props this component accepts from parent pages or tables
interface StatusBadgeProps {
  variant: BadgeVariant; // Which color/style preset to use (required)
  label?: string; // Optional custom text — if omitted, uses default label from lookup table
}

// Lookup table: maps each variant to background, text color, and default label
const variantStyles: Record<
  BadgeVariant,
  { backgroundColor: string; color: string; label: string }
> = {
  healthy: {
    backgroundColor: "#d1fae5", // success-bg — Emerald 100 tint
    color: "#16a34a", // success-dark — Green 600 text on light green
    label: "Healthy", // Default label when no custom label prop is passed
  },
  "at-risk": {
    backgroundColor: "#fef3c7", // warning-bg — Amber 100 tint
    color: "#d97706", // warning-dark — Amber 600 text
    label: "At Risk", // Default label for at-risk clients
  },
  critical: {
    backgroundColor: "#fee2e2", // danger-bg — Red 100 tint
    color: "#991b1b", // danger-dark — Red 800 text
    label: "Critical", // Default label for critical status
  },
  info: {
    backgroundColor: "#dbeafe", // info-bg — Blue 100 tint
    color: "#2563eb", // info — Blue 600 text
    label: "Info", // Default label for informational badges
  },
  pending: {
    backgroundColor: "#dbeafe", // same as info — Blue 100 tint
    color: "#2563eb", // same as info — Blue 600 text
    label: "Pending", // Default label for pending state
  },
};

const StatusBadge = ({ variant, label }: StatusBadgeProps) => {
  // Read the style object for the chosen variant from the lookup table
  const style = variantStyles[variant];
  // e.g. variant "healthy" → { backgroundColor: "#d1fae5", color: "#16a34a", label: "Healthy" }

  return (
  // Render a span (inline pill) — not a button, it's display-only status text
    <span
      style={{
        display: "inline-flex", // Flex so icon+text could be added later; keeps text vertically centered
        alignItems: "center", // Center content vertically inside the pill
        borderRadius: borderRadius.full, // 9999px — full pill shape from Figma
        backgroundColor: style.backgroundColor, // Background from lookup table for this variant
        color: style.color, // Text color from lookup table for this variant
        fontSize: typography.captionBold.size, // 12px — caption-bold token from design system
        fontWeight: typography.captionBold.weight, // 600 — SemiBold
        padding: "2px 8px", // Figma status-badge spec: 2px top/bottom, 8px left/right
        whiteSpace: "nowrap", // Keep label on one line (e.g. "At Risk" won't wrap)
        lineHeight: 1.2, // Tight line height for compact pill
        boxSizing: "border-box", // Padding included in size calculations
      }}
    >
      {label ?? style.label}
      {/* Show custom label if provided, otherwise use default from variantStyles */}
    </span>
  );
};

export default StatusBadge; // Export so pages can: import StatusBadge from ".../StatusBadge"
