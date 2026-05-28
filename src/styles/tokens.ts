/**
 * DeliveryPulse design tokens — sizes and colors tuned for WCAG 2.1 AA readability.
 * - Body text on white: use text-primary / text-secondary (≥4.5:1 contrast).
 * - text-tertiary is for non-essential metadata only (still ≥4.5:1 on #fff).
 */
export const colors = {
  "brand-blue": "#0088ff",
  "navy-sidebar": "#1c2655",
  "navy-topnav": "#2e3b61",
  "navy-auth": "#2e3b61",
  canvas: "#f1f5f9",
  "surface-card": "#ffffff",
  "surface-subtle": "#f8fafc",
  "surface-blue-tint": "#eff6ff",
  "text-primary": "#1e293b",
  /** Secondary body — slate-600, ~7.3:1 on white */
  "text-secondary": "#475569",
  /** Metadata, timestamps — slate-500, ~4.6:1 on white */
  "text-tertiary": "#64748b",
  /** Sidebar nav labels on navy — light slate for ≥4.5:1 on #1c2655 */
  "text-muted-dark": "#e2e8f0",
  "text-on-dark": "#ffffff",
  "border-default": "#e2e8f0",
  "border-light": "#cbd5e1",
  success: "#10b981",
  "success-dark": "#16a34a",
  "success-bg": "#d1fae5",
  warning: "#f59e0b",
  "warning-dark": "#d97706",
  "warning-bg": "#fef3c7",
  danger: "#dc2626",
  "danger-dark": "#991b1b",
  "danger-bg": "#fee2e2",
  info: "#2563eb",
  "info-bg": "#dbeafe",
  "info-bg-light": "#eff6ff",
  "divider-on-dark": "rgba(255, 255, 255, 0.1)",
} as const;

export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
} as const;

export const borderRadius = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  "2xl": "16px",
  full: "9999px",
} as const;

/** Type scale — minimum 12px UI text; 14px+ for list/body content */
export const typography = {
  heroXl: { size: "48px", weight: "700" },
  heroLg: { size: "36px", weight: "700" },
  displayLg: { size: "32px", weight: "700" },
  displayMd: { size: "28px", weight: "700" },
  titleXl: { size: "24px", weight: "700" },
  titleLg: { size: "22px", weight: "700" },
  brandName: { size: "20px", weight: "700", letterSpacing: "-0.5px" },
  titleMd: { size: "18px", weight: "700" },
  titleSm: { size: "18px", weight: "600" },
  bodyLg: { size: "16px", weight: "400" },
  buttonLg: { size: "16px", weight: "600" },
  bodyMd: { size: "16px", weight: "400" },
  bodySm: { size: "15px", weight: "400" },
  labelMd: { size: "15px", weight: "500" },
  /** List row title (e.g. Slack sender name) */
  listTitle: { size: "14px", weight: "700" },
  /** List row body / preview */
  listBody: { size: "14px", weight: "400" },
  /** List row meta (company, channel, time) */
  listMeta: { size: "13px", weight: "400" },
  captionMd: { size: "13px", weight: "500" },
  captionSm: { size: "13px", weight: "400" },
  captionBold: { size: "13px", weight: "600" },
  tableHeader: { size: "12px", weight: "600" },
  monoSm: { size: "12px", weight: "400", fontFamily: "Geist Mono, monospace" },
  sidebarLabel: { size: "11px", weight: "500", fontFamily: "Inter, sans-serif" },
  badgeCount: { size: "10px", weight: "700", fontFamily: "DM Sans, sans-serif" },
  microBold: { size: "12px", weight: "700", fontFamily: "DM Sans, sans-serif" },
  notificationBadge: {
    size: "10px",
    weight: "700",
    fontFamily: "DM Sans, sans-serif",
  },
} as const;

export const layout = {
  sidebarWidth: "80px",
  topnavHeight: "60px",
  topnavIconButtonSize: "32px",
  topnavAvatarSize: "30px",
  topnavNotificationBadgeSize: "14px",
  sidebarItemHeight: "60px",
  sidebarItemActiveWidth: "64px",
  /** Shared vertical padding for logo block and profile block (Figma spacing.6) */
  sidebarChromePadding: spacing[6],
  logoRowHeight: "40px",
  profileRowHeight: "36px",
  logoSize: "32px",
  iconSize: "20px",
  navGap: "17px",
} as const;

/** Figma MCP asset URLs (node 151:952) — valid ~7 days */
export const figmaAssets = {
  avatar:
    "https://www.figma.com/api/mcp/asset/9964c1fa-c3e4-426f-a722-5ad66a1ea4c2",
  audioWaveform:
    "https://www.figma.com/api/mcp/asset/361fbdf2-b32a-4926-aab4-bfe6eec5630f",
} as const;
