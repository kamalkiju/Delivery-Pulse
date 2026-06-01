// ─────────────────────────────────────────────────────────────────────────────
// SidebarWorkspaceSwitcher — multi-workspace selector (below logo in Sidebar)
//
// Data: GET /api/slack/workspaces
// State: workspaces[], activeWorkspaceId (localStorage), isDropdownOpen
// On switch: localStorage activeWorkspaceId + window event workspace-changed
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getSlackWorkspaces,
  type SlackWorkspaceSummary,
} from "../../api/slack.integration.api";
import {
  getActiveWorkspaceId,
  persistActiveWorkspaceId,
  setActiveWorkspaceId,
  WORKSPACE_SWITCHER_OPEN_EVENT,
} from "../../utils/workspace";
import { switchSlackWorkspace } from "../../api/slack.integration.api";
import { borderRadius, colors, layout, spacing } from "../../styles/tokens";

/** First two letters of workspace name for the circular icon fallback */
function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || "WS").toUpperCase();
}

const SidebarWorkspaceSwitcher = () => {
  const navigate = useNavigate();
  // containerRef — closes dropdown on outside click
  const containerRef = useRef<HTMLDivElement>(null);

  // workspaces — from GET /api/slack/workspaces
  const [workspaces, setWorkspaces] = useState<SlackWorkspaceSummary[]>([]);
  // activeWorkspaceId — localStorage or first workspace after fetch
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(
    () => getActiveWorkspaceId(),
  );
  // isDropdownOpen — toggles the workspace list panel
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  // loadWorkspaces — fetch list and hydrate activeWorkspaceId from storage
  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getSlackWorkspaces();
      setWorkspaces(list);

      const stored = getActiveWorkspaceId();
      const validStored = stored && list.some((w) => w.id === stored);
      const nextId = validStored ? stored : list[0]?.id ?? null;

      if (nextId) {
        persistActiveWorkspaceId(nextId);
        setActiveWorkspaceIdState(nextId);
      }
    } catch {
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Top bar "Switch" shortcut opens this dropdown
  useEffect(() => {
    const openFromTopBar = () => setIsDropdownOpen(true);
    window.addEventListener(WORKSPACE_SWITCHER_OPEN_EVENT, openFromTopBar);
    return () =>
      window.removeEventListener(WORKSPACE_SWITCHER_OPEN_EVENT, openFromTopBar);
  }, []);

  // Close dropdown when user clicks outside the switcher
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", onDocClick);
    }
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isDropdownOpen]);

  // switchWorkspace — persist, dispatch workspace-changed, close menu, call backend
  const switchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    setActiveWorkspaceIdState(workspaceId);
    setIsDropdownOpen(false);
    switchSlackWorkspace(workspaceId).catch(() => {/* best-effort */});
  };

  // Placeholder row while workspaces load
  if (isLoading && workspaces.length === 0) {
    return (
      <div
        aria-hidden
        style={{
          width: layout.sidebarWidth,
          height: "52px",
          flexShrink: 0,
          borderBottom: `1px solid ${colors["divider-on-dark"]}`,
        }}
      />
    );
  }

  // Empty state — no Slack workspaces connected yet
  if (workspaces.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          width: layout.sidebarWidth,
          height: "52px",
          flexShrink: 0,
          borderBottom: `1px solid ${colors["divider-on-dark"]}`,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/settings?tab=slack")}
          style={triggerButtonStyle}
          title="Connect Slack workspace"
        >
          <WorkspaceIcon initials="+" teamIcon={null} onDark />
          <div style={triggerTextColumn}>
            <span style={triggerNameOnDark}>Connect</span>
            <span style={triggerSubtitleOnDark}>Add workspace</span>
          </div>
          <ChevronDown size={14} color={colors["text-on-dark"]} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: layout.sidebarWidth,
        height: "52px",
        flexShrink: 0,
        borderBottom: `1px solid ${colors["divider-on-dark"]}`,
        position: "relative",
        zIndex: isDropdownOpen ? 250 : 1,
      }}
    >
      {/* Workspace selector trigger — 52px row; extends 220px into content area */}
      <button
        type="button"
        onClick={() => setIsDropdownOpen((open) => !open)}
        style={triggerButtonStyle}
        aria-expanded={isDropdownOpen}
        aria-haspopup="listbox"
        aria-label={`Active workspace: ${activeWorkspace?.teamName ?? "Workspace"}`}
      >
        {/* Left: 28px circle — team icon or initials */}
        <WorkspaceIcon
          initials={workspaceInitials(activeWorkspace?.teamName ?? "WS")}
          teamIcon={activeWorkspace?.teamIcon}
          onDark
        />
        {/* Middle: workspace name + "Switch workspace" */}
        <div style={triggerTextColumn}>
          <span style={triggerNameOnDark}>
            {activeWorkspace?.teamName ?? "Workspace"}
          </span>
          <span style={triggerSubtitleOnDark}>Switch workspace</span>
        </div>
        {/* Right: chevron */}
        <ChevronDown
          size={14}
          color={colors["text-on-dark"]}
          style={{
            flexShrink: 0,
            transform: isDropdownOpen ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s ease",
          }}
          aria-hidden
        />
      </button>

      {/* Workspace dropdown — absolute panel, white card, z-index 200 */}
      {isDropdownOpen && (
        <div
          role="listbox"
          aria-label="Your workspaces"
          style={{
            position: "absolute",
            left: layout.sidebarWidth,
            top: 0,
            width: "220px",
            backgroundColor: colors["surface-card"],
            borderRadius: borderRadius.md,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={dropdownHeaderStyle}>Switch Workspace</div>

          {/* Workspace list — each row 44px; checkmark on active */}
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            return (
              <button
                key={ws.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => switchWorkspace(ws.id)}
                style={dropdownRowStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <WorkspaceIcon
                  initials={workspaceInitials(ws.teamName)}
                  teamIcon={ws.teamIcon}
                />
                <span style={dropdownRowLabelStyle}>{ws.teamName}</span>
                {isActive && (
                  <Check size={16} color={colors["brand-blue"]} aria-hidden />
                )}
              </button>
            );
          })}

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: colors["border-default"],
              margin: `${spacing[1]} 0`,
            }}
          />

          {/* Add workspace — navigate to Settings Slack tab */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(false);
              navigate("/settings?tab=slack");
            }}
            style={addWorkspaceRowStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Plus size={16} color={colors["brand-blue"]} aria-hidden />
            Connect new workspace
          </button>
        </div>
      )}
    </div>
  );
};

/** 28px circle icon — Slack team image or initials on navy / white */
function WorkspaceIcon({
  initials,
  teamIcon,
  onDark,
}: {
  initials: string;
  teamIcon?: string | null;
  onDark?: boolean;
}) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: borderRadius.full,
        flexShrink: 0,
        backgroundColor: onDark
          ? "#0088ff"
          : colors["surface-subtle"],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontSize: "11px",
        fontWeight: 600,
        color: onDark ? colors["text-on-dark"] : colors["text-primary"],
      }}
      aria-hidden
    >
      {teamIcon ? (
        <img src={teamIcon} alt="" width={28} height={28} />
      ) : (
        initials
      )}
    </div>
  );
}

// ── Trigger styles (navy sidebar) ───────────────────────────────────────────

const triggerButtonStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: "220px",
  height: "52px",
  padding: `${spacing[2]} ${spacing[3]}`,
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  border: "none",
  backgroundColor: colors["navy-sidebar"],
  cursor: "pointer",
  boxSizing: "border-box",
  textAlign: "left",
};

const triggerTextColumn: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const triggerNameOnDark: CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: colors["text-on-dark"],
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const triggerSubtitleOnDark: CSSProperties = {
  fontSize: "10px",
  color: "rgba(255,255,255,0.5)",
};

// ── Dropdown styles (white panel) ───────────────────────────────────────────

const dropdownHeaderStyle: CSSProperties = {
  padding: `${spacing[2]} ${spacing[3]}`,
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors["text-tertiary"],
};

const dropdownRowStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  padding: `0 ${spacing[3]}`,
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
  textAlign: "left",
};

const dropdownRowLabelStyle: CSSProperties = {
  flex: 1,
  fontSize: "13px",
  fontWeight: 500,
  color: colors["text-primary"],
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const addWorkspaceRowStyle: CSSProperties = {
  width: "100%",
  height: "44px",
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  padding: `0 ${spacing[3]}`,
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
  color: colors["brand-blue"],
  fontSize: "13px",
  fontWeight: 600,
};

export default SidebarWorkspaceSwitcher;
