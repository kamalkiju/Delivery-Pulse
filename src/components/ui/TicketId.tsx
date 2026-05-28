// ─────────────────────────────────────────────
// TicketId — monospace pill for story / ticket IDs (e.g. DP-445, ADO-234)
// Figma token: mono-sm — Geist Mono, 11px Regular
// ─────────────────────────────────────────────

import { borderRadius, colors, typography } from "../../styles/tokens"; // Design tokens shared across DeliveryPulse

export interface TicketIdProps {
  id: string; // Required ticket identifier text, e.g. "DP-445" or "ADO-234"
  color?: string; // Optional text color override; defaults to text-secondary (WCAG AA on white)
}

const TicketId = ({ id, color }: TicketIdProps) => {
  // Destructure props so we can use id and color inside the JSX below
  return (
    // Return a single inline element that sits within table rows or card text
    <code
      // <code> is the HTML element for code-like strings — browsers and screen readers treat it as technical text
      style={{
        fontFamily: typography.monoSm.fontFamily, // Geist Mono — distinguishes IDs from body prose (Figma mono-sm)
        fontSize: typography.monoSm.size, // 11px — compact size used in tables and metadata
        fontWeight: typography.monoSm.weight, // 400 Regular — not bold; IDs are reference labels, not headlines
        color: color ?? colors["text-secondary"],
        backgroundColor: colors["surface-subtle"], // Light gray fill #f8fafc so the ID reads as a small chip
        padding: "2px 6px", // Tight padding — 2px top/bottom, 6px left/right (Figma ticket-id spec)
        borderRadius: borderRadius.xs, // 4px rounded corners — rounded.xs token
        whiteSpace: "nowrap", // Keep "DP-445" on one line inside tables
        lineHeight: 1.2, // Slight line height so the chip does not clip descenders
        boxSizing: "border-box", // Include padding in width/height calculations
        display: "inline-block", // Allow padding/background while flowing inline with surrounding text
      }}
    >
      {id}
      {/* Render the ticket id string passed in from the parent component */}
    </code>
  );
};

export default TicketId; // Export so other files can import: import TicketId from ".../TicketId"

// ─────────────────────────────────────────────
// Usage examples
// ─────────────────────────────────────────────
//
// import TicketId from "./components/ui/TicketId";
//
// // 1) Default styling (tertiary gray on subtle background)
// <TicketId id="DP-445" />
//
// // 2) ADO-style external id
// <TicketId id="ADO-234" />
//
// // 3) Custom color — e.g. link-style brand blue in a detail panel
// <TicketId id="DP-102" color="#0088ff" />
//
// // 4) Inside table cell copy: "Story <TicketId id="DP-445" /> was updated"
// <p style={{ fontSize: "14px", color: "#1e293b" }}>
//   Story <TicketId id="DP-445" /> was auto-created from Slack.
// </p>
