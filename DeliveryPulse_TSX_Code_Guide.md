# DeliveryPulse — Complete TSX Code Guide
## For UI/UX Designers Learning to Code
### Based on your Figma Design System

> This file explains every TSX file in plain English.
> For each file: what it is, what it does, the actual code, and how every variable/function works.
> Colors and sizes match your Figma design system exactly.

---

## FIRST — Design Tokens File
### `src/styles/tokens.ts`

This file stores all your Figma colors, sizes, and fonts as JavaScript variables.
Think of it as your Figma Styles panel — but in code form.
Every other file imports from here so you only change colors in ONE place.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// Your Figma design tokens converted to TypeScript.
// Import these in any component instead of hardcoding colors.
// ─────────────────────────────────────────────

export const colors = {
  // ── BRAND & SHELL ──────────────────────────
  // These are your two dark navy backgrounds from Figma
  "brand-blue": "#0088ff",    // The ONLY interactive color — buttons, active states, links
  "navy-sidebar": "#1c2655",  // The darkest surface — your 80px left sidebar
  "navy-topnav": "#2e3b61",   // Slightly lighter — your 60px top navigation bar
  "navy-auth": "#2e3b61",     // Same as topnav — used for "Welcome back" heading on login

  // ── SURFACES ───────────────────────────────
  // These are your background colors
  "canvas": "#f1f5f9",        // Page background — Slate 100 — wraps everything inside the shell
  "surface-card": "#ffffff",  // Card backgrounds — all white cards sit on top of canvas
  "surface-subtle": "#f8fafc", // Table header rows, alternate row background — Slate 50
  "surface-blue-tint": "#eff6ff", // Active state in settings sidebar — Blue 50

  // ── TEXT ───────────────────────────────────
  "text-primary": "#1e293b",   // Headings, KPI numbers — Slate 800 — darkest text
  "text-secondary": "#64748b", // Body text, labels, descriptions — Slate 500 — most common
  "text-tertiary": "#94a3b8",  // Placeholders, captions, table headers — Slate 400 — lightest
  "text-muted-dark": "#dcdcdc", // Sidebar nav labels on dark background
  "text-on-dark": "#ffffff",   // All text inside sidebar, topnav, auth left panel

  // ── BORDERS ────────────────────────────────
  "border-default": "#e2e8f0", // Standard 1px border — cards, inputs, table rows — Slate 200
  "border-light": "#cbd5e1",   // Slightly darker border for layered surfaces — Slate 300

  // ── STATUS: SUCCESS (Healthy) ──────────────
  "success": "#10b981",        // Healthy client icon color — Emerald 500
  "success-dark": "#16a34a",   // Text inside green badges — Green 600
  "success-bg": "#d1fae5",     // Background of "Healthy" badge — Emerald 100

  // ── STATUS: WARNING (At Risk) ──────────────
  "warning": "#f59e0b",        // At-risk icon, amber dot on sidebar — Amber 400
  "warning-dark": "#d97706",   // Text inside amber badges — Amber 600
  "warning-bg": "#fef3c7",     // Background of "At Risk" badge — Amber 100

  // ── STATUS: DANGER (Critical) ──────────────
  "danger": "#dc2626",         // Critical status, error alerts — Red 600
  "danger-dark": "#991b1b",    // Text inside red badges — Red 800
  "danger-bg": "#fee2e2",      // Background of "Critical" badge — Red 100

  // ── INFO ───────────────────────────────────
  "info": "#2563eb",           // Informational links — Blue 600
  "info-bg": "#dbeafe",        // Background of info badges — Blue 100
  "info-bg-light": "#eff6ff",  // Lightest blue — active setting in nav — Blue 50
};

export const spacing = {
  // These match your Figma spacing scale (4px base)
  1: "4px",   // xs gap
  2: "8px",   // small gap — label to input
  3: "12px",  // compact padding
  4: "16px",  // card grid gap, standard padding
  5: "20px",  // card internal padding
  6: "24px",  // content area padding
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px", // auth form padding
};

export const borderRadius = {
  xs: "4px",   // notification badges, small dots
  sm: "6px",   // icon buttons in topnav
  md: "8px",   // DEFAULT — all cards, app buttons, sidebar active item
  lg: "10px",  // settings sub-nav items
  xl: "12px",  // auth buttons and inputs
  "2xl": "16px", // settings main panel
  full: "9999px", // status chips, avatar circles, pill badges
};

export const typography = {
  // Font sizes — from your Figma type scale
  heroXl: { size: "48px", weight: "700" },      // onboarding headline
  heroLg: { size: "36px", weight: "700" },      // onboarding sub-headline
  displayLg: { size: "32px", weight: "700" },   // KPI numbers on dashboard
  displayMd: { size: "28px", weight: "700" },   // "Welcome back" on login
  titleXl: { size: "24px", weight: "700" },     // page titles
  titleLg: { size: "22px", weight: "700" },     // card section titles
  brandName: { size: "20px", weight: "700", letterSpacing: "-0.5px" }, // "DeliveryPulse" logo
  titleMd: { size: "18px", weight: "700" },     // top nav page title
  titleSm: { size: "18px", weight: "600" },     // card headers
  bodyLg: { size: "16px", weight: "400" },      // standard body
  buttonLg: { size: "16px", weight: "600" },    // primary button label
  bodyMd: { size: "15px", weight: "400" },      // card descriptions
  bodySm: { size: "14px", weight: "400" },      // standard UI text, form inputs
  labelMd: { size: "14px", weight: "500" },     // form labels
  captionMd: { size: "12px", weight: "500" },   // stat card labels
  captionSm: { size: "12px", weight: "400" },   // timestamps, metadata
  captionBold: { size: "12px", weight: "600" }, // chip/tag text
  tableHeader: { size: "11px", weight: "600" }, // UPPERCASE table column headers
  monoSm: { size: "11px", weight: "400", fontFamily: "Geist Mono" }, // ticket IDs like DP-445
  sidebarLabel: { size: "9px", weight: "400", fontFamily: "Inter" }, // sidebar icon labels
};
```

---

## FILE 1 — App Shell
### `src/components/layout/AppShell.tsx`

This is the wrapper that appears on EVERY authenticated page.
It contains the sidebar + topnav + page content.
Think of it as the frame of a window — the content changes but the frame stays.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// The main layout wrapper. Every page after login is wrapped inside this.
// It renders: Left sidebar + Top navbar + Page content area.
//
// WHERE IT IS USED:
// Every authenticated page wraps its content inside <AppShell>.
// e.g. Dashboard, Slack Messages, Review Queue, Settings etc.
// ─────────────────────────────────────────────

import React from "react";
// React is the library that lets us write JSX (HTML inside JavaScript)

// This says: AppShell accepts a "children" prop
// children = whatever page content is placed inside <AppShell>...</AppShell>
interface AppShellProps {
  children: React.ReactNode;  // React.ReactNode = any valid JSX content
  pageTitle: string;          // The title shown in the top nav e.g. "Dashboard"
}

const AppShell = ({ children, pageTitle }: AppShellProps) => {
  // ── WHAT THIS FUNCTION DOES ──────────────────
  // Renders the full page layout:
  // [Sidebar 80px] [Main area: TopNav 60px + Content area]
  // The content area wraps the "children" passed in

  return (
    <div
      style={{
        display: "flex",           // Side by side: sidebar + main
        height: "100vh",           // 100vh = full browser height
        backgroundColor: "#f1f5f9", // canvas color — Slate 100
      }}
    >
      {/* ── SIDEBAR ────────────────────────── */}
      {/* This is the 80px dark navy left bar with icons */}
      <Sidebar />

      {/* ── MAIN AREA (right of sidebar) ─────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* flex:1 means "take all remaining width after sidebar" */}
        {/* flexDirection column = TopNav on top, Content below */}

        {/* ── TOP NAV ──────────────────────── */}
        {/* The 60px dark navy bar at top showing page title */}
        <TopNav title={pageTitle} />

        {/* ── PAGE CONTENT ─────────────────── */}
        {/* 24px padding around all page content — from Figma spacing.6 */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",     // scroll if content is tall
            padding: "24px",       // spacing.6 = 24px from your Figma spacing scale
          }}
        >
          {children}
          {/* children = the actual page content (Dashboard, Slack Messages etc.) */}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
```

---

## FILE 2 — Sidebar
### `src/components/layout/Sidebar.tsx`

This is the 80px dark navy icon bar on the left.
In Figma: your "sidebar" component — navy-sidebar (#1c2655), icon + 9px label.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// The 80px fixed left sidebar with navigation icons.
// Shows icon + small label for each section.
// Active item has brand-blue (#0088ff) background.
// Badges show counts (blue for Slack, amber for Review Queue).
//
// FROM YOUR FIGMA DESIGN SYSTEM:
// - Background: navy-sidebar #1c2655
// - Active item: brand-blue #0088ff fill, radius 8px
// - Icon: 20px
// - Label: 9px Inter (sidebar-label token)
// - Badge: 14x14px, radius 4px, brand-blue or warning fill
// ─────────────────────────────────────────────

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
// useNavigate = lets us move to a different page when nav item is clicked
// useLocation = tells us which page we are currently on (to show active state)

// This defines what each nav item looks like
interface NavItem {
  icon: string;       // the icon name e.g. "home", "slack"
  label: string;      // the text below the icon e.g. "Dashboard"
  path: string;       // the URL it goes to e.g. "/dashboard"
  badgeCount?: number; // optional number shown in badge e.g. 8
  badgeColor?: "blue" | "amber"; // badge color — blue for Slack, amber for queue
}

// List of all sidebar navigation items
const navItems: NavItem[] = [
  { icon: "home", label: "Dashboard", path: "/dashboard" },
  { icon: "slack", label: "Slack", path: "/slack", badgeCount: 3, badgeColor: "blue" },
  { icon: "checklist", label: "Stories", path: "/stories" },
  { icon: "eye", label: "Review", path: "/review", badgeCount: 8, badgeColor: "amber" },
  { icon: "file", label: "Docs", path: "/documents" },
  { icon: "video", label: "Meetings", path: "/meetings" },
  { icon: "users", label: "Clients", path: "/clients" },
  { icon: "chart", label: "Reports", path: "/reports" },
  { icon: "settings", label: "Settings", path: "/settings" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  // navigate("/dashboard") = go to dashboard page

  const location = useLocation();
  // location.pathname = current URL e.g. "/dashboard"
  // We use this to decide which item is "active"

  return (
    <aside
      style={{
        width: "80px",                    // Fixed 80px wide — from Figma spec
        height: "100vh",                  // Full screen height
        backgroundColor: "#1c2655",       // navy-sidebar from your Figma tokens
        display: "flex",
        flexDirection: "column",          // Stack items top to bottom
        alignItems: "center",             // Center icons horizontally
        padding: "24px 0",               // spacing.6 top/bottom from Figma
        position: "fixed",               // Stays in place when you scroll
        left: 0,
        top: 0,
        zIndex: 100,                     // Sits above page content
      }}
    >
      {/* ── LOGO AREA ─────────────────────── */}
      {/* The white rounded square with waveform icon at very top */}
      <div
        style={{
          width: "32px",
          height: "32px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",            // rounded.md from Figma
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        {/* Waveform icon — represents "DeliveryPulse" */}
        <span style={{ fontSize: "18px" }}>〜</span>
      </div>

      {/* ── DIVIDER ───────────────────────── */}
      {/* 1px white line at 10% opacity — divider-on-dark from Figma */}
      <div
        style={{
          width: "80%",
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.1)",
          marginBottom: "20px",
        }}
      />

      {/* ── NAV ITEMS ─────────────────────── */}
      {/* Loop through navItems array and render each one */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        {navItems.map((item) => {
          // Check if this item is the current active page
          const isActive = location.pathname === item.path;
          // isActive = true when we are on this page, false otherwise

          return (
            <div
              key={item.path}  // key is needed when rendering a list in React
              onClick={() => navigate(item.path)}  // Click goes to this page
              style={{
                width: "80px",
                height: isActive ? "55px" : "60px",    // Active is slightly shorter
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                cursor: "pointer",                     // Mouse pointer on hover
                borderRadius: "8px",                   // rounded.md
                backgroundColor: isActive
                  ? "#0088ff"                          // Active: brand-blue fill
                  : "transparent",                     // Inactive: no fill
                position: "relative",                  // For badge positioning
              }}
            >
              {/* Icon */}
              <span
                style={{
                  fontSize: "20px",
                  color: "#ffffff",                    // Always white — text-on-dark
                }}
              >
                {/* In real code this would be an actual icon component */}
                {item.icon}
              </span>

              {/* Label — 9px Inter */}
              <span
                style={{
                  fontSize: "9px",
                  fontFamily: "Inter",                 // sidebar-label uses Inter font
                  color: isActive ? "#ffffff" : "#dcdcdc", // Active: white, inactive: muted
                }}
              >
                {item.label}
              </span>

              {/* Badge — shown only if badgeCount exists */}
              {item.badgeCount && (
                <div
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "10px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "4px",               // rounded.xs from Figma
                    backgroundColor: item.badgeColor === "blue"
                      ? "#0088ff"                      // brand-blue for Slack
                      : "#f59e0b",                     // warning for Review Queue
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "8px",
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  {item.badgeCount}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── DIVIDER ───────────────────────── */}
      <div style={{ width: "80%", height: "1px", backgroundColor: "rgba(255,255,255,0.1)", margin: "16px 0" }} />

      {/* ── USER AVATAR ───────────────────── */}
      {/* 32px circular avatar at bottom */}
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "9999px",          // rounded.full = perfect circle
          backgroundColor: "#0088ff",      // brand-blue default
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: "700",
          color: "#ffffff",
        }}
      >
        RM
        {/* In real code: user initials from logged-in user data */}
      </div>
    </aside>
  );
};

export default Sidebar;
```

---

## FILE 3 — Status Badge
### `src/components/ui/StatusBadge.tsx`

This is the small coloured pill showing "Healthy", "At Risk", or "Critical".
Used everywhere — client tables, story cards, dashboards.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// A reusable coloured pill badge.
// You pass in a "variant" and it shows the right color automatically.
//
// FROM YOUR FIGMA DESIGN SYSTEM:
// - Shape: pill (rounded.full = 9999px)
// - Font: caption-bold (12px SemiBold)
// - Padding: 2px 8px
// - Healthy: bg #d1fae5, text #16a34a
// - At Risk: bg #fef3c7, text #d97706
// - Critical: bg #fee2e2, text #991b1b
// - Info/Pending: bg #dbeafe, text #2563eb
//
// HOW TO USE IN OTHER FILES:
// <StatusBadge variant="healthy" />
// <StatusBadge variant="critical" />
// ─────────────────────────────────────────────

// TypeScript type — defines what values "variant" can be
type BadgeVariant = "healthy" | "at-risk" | "critical" | "info" | "pending";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string; // optional custom label — if not given uses default text
}

// Object that maps each variant to its Figma colors
// This is called a "lookup table" — very common pattern
const variantStyles = {
  healthy: {
    backgroundColor: "#d1fae5",  // success-bg from Figma
    color: "#16a34a",             // success-dark from Figma
    label: "Healthy",
  },
  "at-risk": {
    backgroundColor: "#fef3c7",  // warning-bg from Figma
    color: "#d97706",             // warning-dark from Figma
    label: "At Risk",
  },
  critical: {
    backgroundColor: "#fee2e2",  // danger-bg from Figma
    color: "#991b1b",             // danger-dark from Figma
    label: "Critical",
  },
  info: {
    backgroundColor: "#dbeafe",  // info-bg from Figma
    color: "#2563eb",             // info from Figma
    label: "Info",
  },
  pending: {
    backgroundColor: "#dbeafe",  // same as info
    color: "#2563eb",
    label: "Pending",
  },
};

const StatusBadge = ({ variant, label }: StatusBadgeProps) => {
  // Get the colors and default label for this variant
  const style = variantStyles[variant];
  // e.g. if variant = "healthy", style = { bg: "#d1fae5", color: "#16a34a", label: "Healthy" }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",         // rounded.full — pill shape from Figma
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontSize: "12px",               // caption-bold size from Figma
        fontWeight: "600",              // SemiBold — caption-bold weight from Figma
        padding: "2px 8px",            // From Figma status-badge spec
        whiteSpace: "nowrap",          // Don't wrap text onto next line
      }}
    >
      {label || style.label}
      {/* Use custom label if given, otherwise use default from variantStyles */}
    </span>
  );
};

export default StatusBadge;
```

---

## FILE 4 — Stat Card
### `src/components/ui/StatCard.tsx`

This is one of the 4 KPI cards at the top of the Dashboard.
Shows a big number, a label, and a trend indicator.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// One of the 4 KPI cards shown at top of dashboard.
// Shows: icon + label + big number + trend text.
//
// FROM YOUR FIGMA DESIGN SYSTEM:
// - Size: 316x174px in 4-up grid
// - Background: surface-card white
// - Radius: rounded.md 8px
// - Padding: 20px (spacing.5)
// - KPI value: display-lg 32px Bold, text-primary #1e293b
// - Label: caption-md 12px Medium, text-secondary #64748b
// - Trend: caption-sm 12px Regular, text-tertiary #94a3b8
// ─────────────────────────────────────────────

interface StatCardProps {
  label: string;         // e.g. "Active Clients"
  value: string | number; // e.g. "12" or 47
  trend?: string;        // e.g. "↑ 6 from last week"
  trendColor?: string;   // e.g. "#16a34a" for green trend
  icon?: string;         // icon name
  iconBgColor?: string;  // icon background color e.g. "#dbeafe"
  iconColor?: string;    // icon color e.g. "#2563eb"
  borderLeftColor?: string; // optional colored left border for critical cards
}

const StatCard = ({
  label, value, trend, trendColor,
  icon, iconBgColor, iconColor, borderLeftColor
}: StatCardProps) => {

  return (
    <div
      style={{
        backgroundColor: "#ffffff",      // surface-card from Figma
        borderRadius: "8px",             // rounded.md — default for all cards
        padding: "20px",                 // spacing.5 — card internal padding from Figma
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        // Optional left border for critical cards (red left border)
        borderLeft: borderLeftColor
          ? `3px solid ${borderLeftColor}`
          : "1px solid #e2e8f0",         // border-default from Figma
        borderTop: "1px solid #e2e8f0",
        borderRight: "1px solid #e2e8f0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      {/* ── ICON ──────────────────────────── */}
      {icon && (
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",         // rounded.md
            backgroundColor: iconBgColor || "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: iconColor || "#64748b",
          }}
        >
          {icon}
        </div>
      )}

      {/* ── LABEL ─────────────────────────── */}
      {/* caption-md: 12px Medium, text-secondary */}
      <span
        style={{
          fontSize: "12px",
          fontWeight: "500",
          color: "#64748b",              // text-secondary from Figma
        }}
      >
        {label}
      </span>

      {/* ── KPI VALUE ─────────────────────── */}
      {/* display-lg: 32px Bold, text-primary */}
      <span
        style={{
          fontSize: "32px",
          fontWeight: "700",
          color: "#1e293b",              // text-primary from Figma
          lineHeight: "1",
        }}
      >
        {value}
      </span>

      {/* ── TREND ─────────────────────────── */}
      {/* caption-sm: 12px Regular */}
      {trend && (
        <span
          style={{
            fontSize: "12px",
            fontWeight: "400",
            color: trendColor || "#94a3b8", // text-tertiary by default
          }}
        >
          {trend}
        </span>
      )}
    </div>
  );
};

export default StatCard;
```

---

## FILE 5 — Login Page
### `src/pages/auth/LoginPage.tsx`

The first screen users see. Split layout: left navy panel + right white form.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// The login page — first thing any user sees.
// Split screen: 792px navy left + 648px white right.
//
// FROM YOUR FIGMA DESIGN SYSTEM:
// - Left panel: navy-sidebar #1c2655, hero-xl 48px Bold white text
// - Right panel: white, form 360px wide, auth padding 80px
// - Input: radius xl 12px, height 44-48px, border-default
// - Primary button: brand-blue #0088ff, radius xl 12px, height 48px
// - SSO button: white, border-default, radius xl 12px, height 44px
// - "Welcome back": display-md 28px Bold, navy-auth #2e3b61
// ─────────────────────────────────────────────

import React, { useState } from "react";
// useState = lets us store data that can change e.g. email value, error messages

import { useNavigate } from "react-router-dom";
// useNavigate = lets us redirect to dashboard after successful login

const LoginPage = () => {
  const navigate = useNavigate();

  // ── STATE VARIABLES ───────────────────────
  // These store values that can change when user types or clicks

  const [email, setEmail] = useState("");
  // email = current value in email input
  // setEmail = function to update email
  // useState("") = starts as empty string

  const [password, setPassword] = useState("");
  // Same pattern for password

  const [isLoading, setIsLoading] = useState(false);
  // isLoading = true while API call is happening (shows spinner)
  // false = not loading

  const [error, setError] = useState<string | null>(null);
  // error = null means no error, string means show error message
  // e.g. error = "Incorrect password. Please try again."

  // ── LOGIN FUNCTION ────────────────────────
  const handleLogin = async () => {
    // async = this function can wait for API response
    setIsLoading(true);   // Show loading spinner on button
    setError(null);       // Clear any previous error messages

    try {
      // Call your backend login API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        // JSON.stringify converts object to text for sending to API
      });

      if (response.ok) {
        // Login successful — go to dashboard
        navigate("/dashboard");
      } else {
        // Login failed — show error
        const data = await response.json();
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch (err) {
      // Network error — server unreachable
      setError("Unable to connect to server. Check your internet connection.");
    } finally {
      setIsLoading(false); // Always hide spinner when done
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* ── LEFT PANEL (792px) ────────────── */}
      {/* Navy brand panel with hero text */}
      <div
        style={{
          width: "55%",                   // ~792px of 1440px total
          backgroundColor: "#1c2655",     // navy-sidebar from Figma
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px 80px",           // spacing.20 = 80px from Figma auth panel spec
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", backgroundColor: "#0088ff", borderRadius: "8px" }} />
          <span style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.5px" }}>
            DeliveryPulse
            {/* brand-name token: 20px Bold, -0.5px letter spacing */}
          </span>
        </div>

        {/* Hero copy */}
        <div>
          <h1 style={{ fontSize: "48px", fontWeight: "700", color: "#ffffff", lineHeight: "110%", marginBottom: "24px" }}>
            Stop finding out about client problems too late
            {/* hero-xl: 48px Bold 110% line height from Figma */}
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.7)", lineHeight: "150%" }}>
            Real-time AI delivery intelligence for your entire team.
            {/* body-intro: 18px Regular 150% line height */}
          </p>
        </div>

        {/* Mini dashboard card at bottom */}
        <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "8px", padding: "16px", border: "1px solid rgba(255,255,255,0.15)" }}>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Live preview</p>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "28px", fontWeight: "800", color: "#10b981" }}>87</span>
            <div>
              <p style={{ fontSize: "13px", color: "#ffffff", fontWeight: "600" }}>TechCorp — Healthy</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Response 1.2h · On-time 94%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (648px) ───────────── */}
      {/* White form panel */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Form container — 360px wide, centered */}
        <div style={{ width: "360px" }}>
          {/* Title */}
          <h2 style={{ fontSize: "28px", fontWeight: "700", color: "#2e3b61", marginBottom: "8px" }}>
            Welcome back
            {/* display-md: 28px Bold, navy-auth #2e3b61 from Figma */}
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "32px" }}>
            Sign in to your DeliveryPulse workspace
          </p>

          {/* Error banner — only shows when error state is not null */}
          {error && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px", fontSize: "13px", color: "#991b1b" }}>
              {error}
              {/* error variable from useState — shows the error message */}
            </div>
          )}

          {/* Email field */}
          <div style={{ marginBottom: "20px" }}>
            {/* spacing.5 = 20px gap between form fields from Figma */}
            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#1e293b", marginBottom: "8px" }}>
              Work email
              {/* label-md: 14px Medium, text-primary — form-label from Figma */}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // e.target.value = whatever user typed in the input
              // setEmail updates the email state variable
              placeholder="you@company.com"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "12px",          // rounded.xl for auth inputs from Figma
                border: "1px solid #e2e8f0",   // border-default from Figma
                padding: "0 16px",
                fontSize: "14px",              // body-sm from Figma
                outline: "none",
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: "8px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#1e293b", marginBottom: "8px" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{ width: "100%", height: "48px", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "0 16px", fontSize: "14px", outline: "none" }}
            />
          </div>

          {/* Forgot password link */}
          <div style={{ textAlign: "right", marginBottom: "24px" }}>
            <span style={{ fontSize: "14px", color: "#0088ff", cursor: "pointer" }}>
              Forgot password?
              {/* brand-blue — label-action color from Figma */}
            </span>
          </div>

          {/* Sign In button */}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            // disabled = cannot click while loading
            style={{
              width: "100%",
              height: "48px",
              backgroundColor: isLoading ? "#94a3b8" : "#0088ff",
              // Gray when loading, brand-blue when ready
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",            // rounded.xl for auth buttons from Figma
              fontSize: "16px",               // button-lg from Figma
              fontWeight: "600",              // SemiBold — always for buttons
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
            {/* Shows different text based on loading state */}
          </button>

          {/* OR divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>OR</span>
            {/* auth-divider from Figma: two lines + OR label, text-tertiary */}
            <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
          </div>

          {/* Microsoft SSO button */}
          <button
            style={{
              width: "100%",
              height: "44px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",    // border-default
              borderRadius: "12px",            // rounded.xl
              fontSize: "14px",
              fontWeight: "600",              // button-md SemiBold from Figma
              color: "#2e3b61",               // navy-auth color from Figma
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            Microsoft logo  Continue with Microsoft
            {/* button-sso component from your Figma design system */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
```

---

## FILE 6 — Dashboard Page
### `src/pages/dashboard/DashboardPage.tsx`

The main screen after login. Shows 4 KPI cards, client health table, AI activity.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// The main dashboard — first screen after login.
// Uses StatCard, StatusBadge, and AppShell components.
//
// LAYOUT FROM FIGMA:
// - 4 stat cards in a row (316px each, 16px gap)
// - Below: left content 916px + right activity panel 380px
// - Content area padding: 24px
// ─────────────────────────────────────────────

import React, { useState, useEffect } from "react";
// useEffect = runs code when the page loads (fetches data from API)

import AppShell from "../../components/layout/AppShell";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";

// TypeScript type defining what one client row looks like
interface Client {
  id: string;
  name: string;
  company: string;
  healthScore: number;      // 0-100
  status: "healthy" | "at-risk" | "critical";
  lastActivity: string;     // e.g. "2h ago"
}

const DashboardPage = () => {
  // ── STATE ─────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  // clients = array of client objects from the API
  // starts as empty array []

  const [isLoading, setIsLoading] = useState(true);
  // true = still loading data, false = data is ready

  // ── FETCH DATA ON PAGE LOAD ───────────────
  useEffect(() => {
    // useEffect runs this function when the page first loads
    const fetchDashboardData = async () => {
      try {
        const response = await fetch("/api/dashboard");
        const data = await response.json();
        setClients(data.clients);  // Update clients state with API data
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setIsLoading(false);       // Stop loading regardless of success/failure
      }
    };

    fetchDashboardData();
  }, []);
  // [] = empty dependency array = run only once when page loads

  // ── HELPER FUNCTION ───────────────────────
  // Converts health score number to a color string
  const getScoreColor = (score: number): string => {
    if (score >= 80) return "#10b981";  // success green — healthy
    if (score >= 60) return "#f59e0b";  // warning amber — at risk
    return "#dc2626";                   // danger red — critical
  };

  return (
    <AppShell pageTitle="Dashboard">
      {/* AppShell wraps all content with sidebar + topnav */}

      {/* ── 4 STAT CARDS ROW ──────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",  // 4 equal columns
          gap: "16px",                             // spacing.4 = 16px gap from Figma
          marginBottom: "20px",                   // spacing.5 between sections
        }}
      >
        <StatCard label="Active clients" value="12" trend="2 at risk · 1 critical" trendColor="#dc2626" />
        <StatCard label="Stories this week" value="47" trend="34 auto-created by AI" trendColor="#7c3aed" />
        <StatCard label="Avg health score" value="74" trend="↑ 6 from last week" trendColor="#16a34a" />
        <StatCard label="SLA at risk" value="3" trend="Action needed today" trendColor="#dc2626" borderLeftColor="#dc2626" />
      </div>

      {/* ── TWO COLUMN SECTION ────────────── */}
      {/* Left: client table (60%) + Right: activity panel (38%) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "16px", marginBottom: "20px" }}>
        {/* ── CLIENT HEALTH TABLE ─────────── */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b" }}>
              Client health overview
              {/* title-sm: 18px SemiBold from Figma */}
            </h2>
            <span style={{ fontSize: "14px", color: "#0088ff", cursor: "pointer" }}>View all →</span>
          </div>

          {/* Table header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 100px", padding: "10px 20px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            {/* surface-subtle background for table header — from Figma */}
            {["CLIENT", "HEALTH SCORE", "ISSUES", "STATUS"].map(col => (
              <span key={col} style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" }}>
                {col}
                {/* table-header: 11px SemiBold UPPERCASE, text-tertiary — from Figma */}
              </span>
            ))}
          </div>

          {/* Table data rows */}
          {isLoading ? (
            // Show skeleton placeholders while loading
            [1,2,3].map(i => (
              <div key={i} style={{ height: "56px", backgroundColor: "#f1f5f9", margin: "8px 0", borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
            ))
          ) : (
            clients.map(client => (
              <div
                key={client.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 80px 100px",
                  padding: "14px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                  backgroundColor: client.status === "critical" ? "rgba(220,38,38,0.04)" : "#ffffff",
                  // Very light red tint for critical clients
                  borderLeft: client.status === "critical" ? "3px solid #dc2626" : "none",
                  // Red left border for critical clients — danger-bg-subtle
                }}
              >
                {/* Client name */}
                <span style={{ fontSize: "14px", color: "#1e293b", fontWeight: "500" }}>
                  {client.name}
                </span>

                {/* Health score with colored number */}
                <span style={{ fontSize: "18px", fontWeight: "800", color: getScoreColor(client.healthScore) }}>
                  {client.healthScore}
                  {/* score-lg: 18px ExtraBold from Figma */}
                </span>

                {/* Last activity */}
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {client.lastActivity}
                </span>

                {/* Status badge component */}
                <StatusBadge variant={client.status} />
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT ACTIVITY PANEL ─────────── */}
        {/* ai-activity-panel: 380px, white, rounded.md, pad 20 from Figma */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", marginBottom: "16px" }}>
            AI activity
          </h2>
          <p style={{ fontSize: "14px", color: "#64748b" }}>Recent AI actions appear here...</p>
        </div>
      </div>
    </AppShell>
  );
};

export default DashboardPage;
```

---

## FILE 7 — Ticket ID Display
### `src/components/ui/TicketId.tsx`

Tiny but important. Displays story IDs like "DP-445" in Geist Mono font.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// Renders ticket/story IDs in monospace font.
// e.g. DP-445 or ADO-234
//
// FROM YOUR FIGMA DESIGN SYSTEM:
// - Font: Geist Mono (mono-sm token)
// - Size: 11px
// - Weight: 400 Regular
// - Color: text-tertiary #94a3b8 typically
// - Purpose: visually distinguish IDs from prose text
// ─────────────────────────────────────────────

interface TicketIdProps {
  id: string;       // e.g. "DP-445"
  color?: string;   // optional color override
}

const TicketId = ({ id, color }: TicketIdProps) => {
  return (
    <code
      style={{
        fontFamily: "'Geist Mono', monospace",  // mono-sm token from Figma
        fontSize: "11px",                          // mono-sm size
        fontWeight: "400",                         // Regular
        color: color || "#94a3b8",                // text-tertiary by default
        backgroundColor: "#f8fafc",              // surface-subtle light background
        padding: "2px 6px",
        borderRadius: "4px",                     // rounded.xs
      }}
    >
      {id}
    </code>
  );
};

export default TicketId;

// USAGE EXAMPLE:
// <TicketId id="DP-445" />
// <TicketId id="ADO-234" color="#0088ff" />
```

---

## FILE 8 — App Routes
### `src/routes/AppRoutes.tsx`

This file defines which URL shows which page.

```typescript
// ─────────────────────────────────────────────
// WHAT THIS FILE IS:
// Maps URLs to page components.
// When user goes to /dashboard → show DashboardPage
// When user goes to /login → show LoginPage
// Also handles protected routes (must be logged in)
// ─────────────────────────────────────────────

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
// Routes = container for all route definitions
// Route = maps one URL to one component
// Navigate = redirect to another URL

import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
// Import each page component

// Helper to check if user is logged in
const isAuthenticated = (): boolean => {
  const token = localStorage.getItem("auth-token");
  // localStorage stores data in browser between sessions
  // If token exists = logged in, if null = not logged in
  return token !== null;
};

// Protected Route wrapper
// If not logged in → redirect to login
// If logged in → show the page
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
    // replace = don't add to browser history (can't go back)
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* ── PUBLIC ROUTES (no login needed) ── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── PROTECTED ROUTES (login required) ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Add more protected routes here for each screen */}

      {/* ── DEFAULT REDIRECT ────────────── */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* Going to "/" redirects to dashboard */}

      {/* ── 404 PAGE ────────────────────── */}
      <Route path="*" element={<div>Page not found</div>} />
      {/* "*" matches any URL not matched above */}
    </Routes>
  );
};

export default AppRoutes;
```

---

## QUICK REFERENCE — What Each Variable Type Means

```typescript
// STRING — text in quotes
const name: string = "TechCorp";

// NUMBER — just a number, no quotes
const score: number = 87;

// BOOLEAN — true or false only
const isLoading: boolean = false;

// ARRAY — list of items in []
const clients: string[] = ["TechCorp", "GlobalRetail"];

// OBJECT — data with named properties
const client = {
  name: "TechCorp",
  score: 87,
  status: "healthy"
};

// INTERFACE — defines the shape of an object (like a Figma component spec)
interface Client {
  name: string;
  score: number;
  status: string;
}

// PROPS — what you pass into a component (like Figma component properties)
// <StatCard label="Clients" value={12} />
// label and value are "props"

// useState — stores a value that can change
const [count, setCount] = useState(0);
// count = current value
// setCount = function to update it
// useState(0) = starts at 0

// useEffect — runs code when page loads
useEffect(() => {
  fetchData(); // runs once when component mounts
}, []);

// async/await — waits for API response
const data = await fetch("/api/clients");
// await = pause here until API responds, then continue
```

---

## HOW TO USE THIS GUIDE IN CURSOR

1. Save this file as `CODE_GUIDE.md` in your project root
2. In Cursor: open a new file, e.g. `src/components/ui/StatusBadge.tsx`
3. Type to Cursor: "Build this component exactly as described in CODE_GUIDE.md using the DeliveryPulse design tokens"
4. Cursor reads your design guide and generates matching code
5. For each new file: tell Cursor which file from the guide you want to build

---

*Built from your Figma design MD file · All colors, sizes, and specs match your design system*
