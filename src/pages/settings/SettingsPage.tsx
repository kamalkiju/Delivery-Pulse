// ─────────────────────────────────────────────
// SettingsPage — workspace and integration configuration
// Built to match DeliveryPulse Figma “Settings” layout + user specs
// ─────────────────────────────────────────────

import { useEffect, useMemo, useState, type CSSProperties } from “react”;
import { useLocation, useNavigate, useSearchParams } from “react-router-dom”;
import { AlertTriangle, Check, Slack } from “lucide-react”; // Icons for status/error affordances — consistent with the app icon set
import AppShell from “../../components/layout/AppShell”; // AppShell wraps sidebar + topnav — pageTitle becomes “Settings”
import api from “../../api/axios”; // Shared axios instance — baseURL is already VITE_API_URL/api
import {
  disconnectSlackWorkspace,
  getSlackChannels,
  getSlackStatus,
  getSlackWorkspaces,
  updateSlackChannel,
  type SlackChannelItem,
  type SlackClientOption,
  type SlackWorkspaceSummary,
} from “../../api/slack.integration.api”;
import { borderRadius, colors, spacing, typography } from "../../styles/tokens"; // Tokens ensure every color/spacing matches DeliveryPulse

// ── Types ────────────────────────────────────────────────────

type SettingsSection =
  | "profile" // Workspace: Profile
  | "organisation" // Workspace: Organisation
  | "team-members" // Workspace: Team Members
  | "slack-setup" // Integrations: Slack Setup (default / active)
  | "ado-setup" // Integrations: ADO Setup
  | "teams-setup" // Integrations: Teams Setup
  | "ai-settings" // Integrations: AI Settings
  | "alert-rules" // Notifications: Alert Rules
  | "email-reports" // Notifications: Email Reports
  | "authentication" // Security: Authentication
  | "audit-logs"; // Security: Audit Logs

interface NavItem {
  id: SettingsSection; // Which section this nav item opens
  label: string; // Visible label in the sub-nav
  icon: string; // Emoji icon per spec — simple, designer-friendly
}

interface RoleRow {
  name: string; // Person name
  username: string; // Slack username
  role: string; // Team role label
}

// ── Static data (role mapping only — channels loaded from API) ────────────────

const roleMapping: RoleRow[] = [
  { name: "Vijay M", username: "@vijay.m", role: "Project Manager" },
  { name: "Sneha N", username: "@sneha.n", role: "Business Analyst" },
  { name: "Deepak K", username: "@deepak.k", role: "Developer" },
]; // Table rows per spec — maps Slack users to roles

// ── Page component ───────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    location.pathname.includes("/settings/slack") ? "slack-setup" : "slack-setup",
  );

  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null);
  const [slackTeamId, setSlackTeamId] = useState<string | null>(null);
  const [slackNotice, setSlackNotice] = useState<string | null>(null);
  const [slackWorkspaces, setSlackWorkspaces] = useState<SlackWorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  // ── Real channel data loaded from API ───────────────────────
  const [channels, setChannels] = useState<SlackChannelItem[]>([]);
  const [clients, setClients] = useState<SlackClientOption[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  // loadChannels — fetch channels + clients for the given workspace
  const loadChannels = (workspaceId: string) => {
    setChannelsLoading(true);
    getSlackChannels(workspaceId)
      .then(({ channels: ch, clients: cl }) => {
        setChannels(ch);
        setClients(cl);
      })
      .catch(() => {})
      .finally(() => setChannelsLoading(false));
  };

  const loadSlackStatus = () => {
    Promise.all([getSlackStatus(), getSlackWorkspaces()])
      .then(([s, workspaces]) => {
        setSlackConnected(s.connected);
        setSlackTeamName(s.teamName);
        setSlackTeamId(s.teamId);
        setSlackWorkspaces(workspaces);
        // Resolve the workspace to load channels for
        const wsId = activeWorkspaceId ?? workspaces[0]?.id ?? null;
        if (!activeWorkspaceId && workspaces[0]?.id) {
          setActiveWorkspaceId(workspaces[0].id);
        }
        // Auto-load channels when connected
        if (s.connected && wsId) {
          loadChannels(wsId);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadSlackStatus();
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const workspace = searchParams.get("workspace");
    if (connected === "true" || searchParams.get("slack") === "connected") {
      setSlackConnected(true);
      if (workspace) setSlackTeamName(workspace);
      const wsId = searchParams.get("workspaceId");
      if (wsId) setActiveWorkspaceId(wsId);
      setSlackNotice(`Slack connected${workspace ? ` to ${workspace}` : ""}.`);
      setSearchParams({}, { replace: true });
      loadSlackStatus();
    }
    if (connected === "false" || searchParams.get("error")) {
      const message = searchParams.get("error") ?? searchParams.get("message");
      setSlackNotice(
        message ? `Slack connection failed: ${message}` : "Slack connection failed.",
      );
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Step 1: GET /api/slack/connect-init — authenticated (axios adds JWT header automatically)
  // Step 2: redirect browser to the one-time connect URL returned by the backend
  // No token is ever appended to the URL manually.
  const handleConnectSlack = async () => {
    try {
      const response = await api.get("/slack/connect-init");
      window.location.href = response.data.connectUrl;
    } catch (error) {
      console.error("Failed to initiate Slack connect:", error);
      setSlackNotice("Failed to connect Slack. Please try again.");
    }
  };

  const handleDisconnectSlack = async () => {
    const wsId = activeWorkspaceId ?? slackWorkspaces[0]?.id;
    if (!wsId) return;
    try {
      await disconnectSlackWorkspace(wsId);
      setSlackNotice("Workspace disconnected.");
      loadSlackStatus();
    } catch {
      setSlackNotice("Could not disconnect Slack.");
    }
  };

  // autoReplyEnabled — toggles the auto-reply switch and the textarea enablement
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true); // ON state by default — aligns with typical setup flows

  // tokenExpired — controls the ADO Setup error card state
  const [tokenExpired, setTokenExpired] = useState(true); // True by default — shows the token-expired reconnect guide

  // Current nav lists — grouped by section label to match your left-nav spec
  const navGroups = useMemo(
    () => [
      {
        label: "WORKSPACE",
        items: [
          { id: "profile", label: "Profile", icon: "👤" },
          { id: "organisation", label: "Organisation", icon: "🏢" },
          { id: "team-members", label: "Team Members", icon: "👥" },
        ] satisfies NavItem[],
      },
      {
        label: "INTEGRATIONS",
        items: [
          { id: "slack-setup", label: "Slack Setup", icon: "💬" },
          { id: "ado-setup", label: "ADO Setup", icon: "📋" },
          { id: "teams-setup", label: "Teams Setup", icon: "🎥" },
          { id: "ai-settings", label: "AI Settings", icon: "🤖" },
        ] satisfies NavItem[],
      },
      {
        label: "NOTIFICATIONS",
        items: [
          { id: "alert-rules", label: "Alert Rules", icon: "🔔" },
          { id: "email-reports", label: "Email Reports", icon: "📧" },
        ] satisfies NavItem[],
      },
      {
        label: "SECURITY",
        items: [
          { id: "authentication", label: "Authentication", icon: "🔐" },
          { id: "audit-logs", label: "Audit Logs", icon: "📋" },
        ] satisfies NavItem[],
      },
    ],
    [],
  ); // navGroups is static — memo keeps referential stability

  // Right-panel title/subtitle — changes based on the selected section
  const header = useMemo(() => {
    if (activeSection === "slack-setup") {
      return {
        title: "Slack Integration",
        sub: "Connect DeliveryPulse to your Slack workspace",
      };
    }
    if (activeSection === "ado-setup") {
      return {
        title: "Azure DevOps Integration",
        sub: "Sync stories and review queue with your ADO project",
      };
    }
    if (activeSection === "teams-setup") {
      return {
        title: "Microsoft Teams Integration",
        sub: "Connect Teams to sync meetings and transcripts",
      };
    }
    return {
      title: "Settings",
      sub: "Manage your workspace configuration",
    };
  }, [activeSection]); // Recompute when active section changes

  return (
    <AppShell pageTitle="Settings">
      {/* Full-bleed split layout — cancels AppShell 24px padding */}
      <div
        style={{
          margin: `-${spacing[6]}`, // Removes AppShell padding so the sub-nav touches the edge like Figma
          height: "calc(100vh - 60px)", // Spec: height calc(100vh - 60px)
          display: "flex", // Two panel layout
          overflow: "hidden", // Prevents body scroll — right panel handles its own scrolling
          backgroundColor: colors.canvas, // Canvas background behind panels
        }}
      >
        {/* ── LEFT SUB-NAV ─────────────────────────────── */}
        <aside
          style={{
            width: "200px", // Spec: width 200px
            flexShrink: 0, // Prevent shrinking
            backgroundColor: colors["surface-subtle"], // Spec: bg #f8fafc
            borderRight: `1px solid ${colors["border-default"]}`, // Spec: right border
            padding: "16px 0", // Spec: padding 16px 0
            overflowY: "auto", // Allows scrolling if items exceed viewport
          }}
        >
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: spacing[4] }}>
              {/* Section label */}
              <div style={subnavSectionLabel}>{group.label}</div>
              {/* Items */}
              {group.items.map((item) => {
                const isActive = activeSection === item.id; // Active styling rule
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`dp-subnav-item ${isActive ? "dp-subnav-item--active" : ""}`}
                    style={subnavItem}
                    onClick={() => {
                      if (item.id === "profile") {
                        navigate("/profile");
                        return;
                      }
                      setActiveSection(item.id);
                    }}
                  >
                    {/* Icon */}
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px", // Emoji size that feels like 16px icon
                        color: isActive
                          ? colors["brand-blue"] // Active icon blue
                          : colors["text-tertiary"], // Default icon gray
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    {/* Label */}
                    <span style={{ fontSize: typography.bodySm.size }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* ── RIGHT CONTENT AREA ───────────────────────── */}
        <section
          style={{
            flex: 1, // Fill remaining width
            overflowY: "auto", // Spec: overflow-y auto
            padding: spacing[6], // Spec: padding 24px
            backgroundColor: colors.canvas, // Keeps the background consistent with the app
          }}
        >
          {/* Page header for the selected settings section */}
          <div style={{ marginBottom: spacing[5] }}>
            <h1
              style={{
                margin: 0, // Remove default h1 margin
                fontSize: typography.titleLg.size, // 22px title per spec
                fontWeight: 700, // Bold per spec
                color: colors["text-primary"], // #1e293b
              }}
            >
              {header.title}
            </h1>
            <p
              style={{
                margin: `${spacing[2]} 0 0 0`, // Small gap under the title
                fontSize: typography.bodySm.size, // 14px body text
                color: colors["text-secondary"], // #64748b
              }}
            >
              {header.sub}
            </p>
            {/* Divider below the header */}
            <div
              style={{
                height: 1,
                backgroundColor: colors["border-default"],
                marginTop: spacing[4],
              }}
            />
          </div>

          {/* Slack Setup content */}
          {activeSection === "slack-setup" && (
            <div>
              {slackNotice != null && (
                <p
                  style={{
                    margin: `0 0 ${spacing[4]} 0`,
                    fontSize: typography.bodySm.size,
                    color: colors["text-secondary"],
                  }}
                >
                  {slackNotice}
                </p>
              )}

              {/* CONNECTION CARD */}
              <div
                style={{
                  backgroundColor: slackConnected ? "#f0fdf4" : colors["surface-card"],
                  border: `1px solid ${slackConnected ? "#bbf7d0" : colors["border-default"]}`,
                  borderRadius: borderRadius.lg, // Spec: radius 10px
                  padding: spacing[4], // Spec: 16px
                  marginBottom: spacing[5], // Spec: margin-bottom 20px
                  display: "flex", // Layout: icon + info + buttons
                  alignItems: "center", // Center vertically
                  gap: spacing[3], // Spec: gap 12px
                }}
              >
                {/* Slack icon circle */}
                <div
                  style={{
                    width: 40, // Spec: 40px
                    height: 40,
                    borderRadius: borderRadius.full, // Circle
                    backgroundColor: "#dcfce7", // Spec: bg #dcfce7
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <Slack size={20} color={colors["success-dark"]} />
                </div>

                {/* Left info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: colors["text-primary"] }}>
                    {slackConnected && slackTeamName
                      ? `Connected to ${slackTeamName}`
                      : "Not connected"}
                  </div>
                  <div
                    style={{
                      fontSize: typography.captionSm.size,
                      color: slackConnected
                        ? colors["success-dark"]
                        : colors["text-secondary"],
                      marginTop: 2,
                    }}
                  >
                    {slackConnected
                      ? `${slackTeamId ?? "workspace"} · Bot: DeliveryPulse`
                      : "Connect your workspace to ingest client messages"}
                  </div>
                  {slackConnected && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacing[2],
                        marginTop: spacing[2],
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: borderRadius.full,
                          backgroundColor: colors["success-dark"],
                        }}
                      />
                      <span
                        style={{
                          fontSize: typography.monoSm.size,
                          color: colors["success-dark"],
                          fontWeight: 600,
                        }}
                      >
                        Active
                      </span>
                    </div>
                  )}
                </div>

                {/* Right buttons */}
                <div style={{ marginLeft: "auto", display: "flex", gap: spacing[2], flexWrap: "wrap" }}>
                  {!slackConnected ? (
                    <button type="button" style={primaryBtn} onClick={handleConnectSlack}>
                      Connect Slack
                    </button>
                  ) : (
                    <>
                      <button type="button" style={primaryBtn} onClick={handleConnectSlack}>
                        Add Workspace
                      </button>
                      <button type="button" style={ghostBtn} onClick={loadSlackStatus}>
                        Refresh
                      </button>
                      <button
                        type="button"
                        style={disconnectBtn}
                        onClick={handleDisconnectSlack}
                      >
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION — Client Channels (real data from API) */}
              {slackConnected && (
                <div style={{ marginBottom: spacing[5] }}>
                  {/* Section header with inline Refresh button */}
                  <div
                    style={{
                      ...sectionTitle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: spacing[2],
                    }}
                  >
                    <span>Client Channels</span>
                    <button
                      type="button"
                      style={{ ...ghostBtn, height: 28, fontSize: "12px" }}
                      onClick={() => activeWorkspaceId && loadChannels(activeWorkspaceId)}
                    >
                      Refresh
                    </button>
                  </div>

                  {/* Loading state */}
                  {channelsLoading && (
                    <div
                      style={{
                        padding: spacing[4],
                        color: colors["text-secondary"],
                        fontSize: typography.bodySm.size,
                      }}
                    >
                      Loading channels…
                    </div>
                  )}

                  {/* Empty state */}
                  {!channelsLoading && channels.length === 0 && (
                    <div
                      style={{
                        backgroundColor: colors["surface-subtle"],
                        border: `1px solid ${colors["border-default"]}`,
                        borderRadius: borderRadius.md,
                        padding: spacing[5],
                        color: colors["text-secondary"],
                        fontSize: typography.bodySm.size,
                        textAlign: "center",
                      }}
                    >
                      No channels found. Invite the DeliveryPulse bot to your client channels and click Refresh.
                    </div>
                  )}

                  {/* Channels list */}
                  {!channelsLoading && channels.length > 0 && (
                    <div
                      style={{
                        backgroundColor: colors["surface-card"],
                        border: `1px solid ${colors["border-default"]}`,
                        borderRadius: borderRadius.md,
                        overflow: "hidden",
                      }}
                    >
                      {/* Table header */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 180px 60px",
                          padding: "10px 16px",
                          backgroundColor: colors["surface-subtle"],
                          borderBottom: `1px solid ${colors["border-default"]}`,
                        }}
                      >
                        <span style={tableHeaderCell}>CHANNEL</span>
                        <span style={tableHeaderCell}>CLIENT</span>
                        <span style={tableHeaderCell}>MONITOR</span>
                      </div>

                      {/* One row per channel — toggle + client dropdown */}
                      {channels.map((ch) => (
                        <ChannelToggleRow
                          key={ch.id}
                          channel={ch}
                          clients={clients}
                          onUpdate={(updated) =>
                            setChannels((prev) =>
                              prev.map((c) => (c.id === updated.id ? updated : c)),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION — Team Role Mapping */}
              <div style={{ ...sectionTitle, marginTop: spacing[5] }}>Team Role Mapping</div>
              <SettingsTable
                columns={["NAME", "SLACK USERNAME", "ROLE", "ACTIONS"]}
                rows={roleMapping.map((r) => [
                  r.name,
                  r.username,
                  r.role,
                  <span key="edit" style={{ color: colors["brand-blue"], fontWeight: 600 }}>
                    Edit
                  </span>,
                ])}
                footerLink="+ Add Member"
              />

              {/* SECTION — Auto-Reply Settings */}
              <div style={{ ...sectionTitle, marginTop: spacing[5] }}>Auto-Reply Settings</div>

              {/* Toggle row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: colors["surface-subtle"],
                  border: `1px solid ${colors["border-default"]}`,
                  borderRadius: borderRadius.md,
                  padding: `12px 16px`,
                  marginBottom: spacing[3],
                  gap: spacing[3],
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: typography.bodySm.size, fontWeight: 700, color: colors["text-primary"] }}>
                    Send auto-acknowledgement to clients
                  </div>
                  <div style={{ fontSize: typography.captionSm.size, color: colors["text-secondary"], marginTop: 2 }}>
                    Instant reply when client message is received
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => setAutoReplyEnabled((v) => !v)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: borderRadius.full,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: autoReplyEnabled
                      ? colors.success // ON bg #10b981
                      : colors["border-light"], // OFF bg #cbd5e1
                    position: "relative",
                    flexShrink: 0,
                  }}
                  aria-label="Toggle auto-reply"
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: borderRadius.full,
                      backgroundColor: colors["surface-card"],
                      position: "absolute",
                      top: 2,
                      left: autoReplyEnabled ? 20 : 2, // Dot position per spec
                      transition: "left 0.15s ease",
                    }}
                  />
                </button>
              </div>

              {/* Template textarea */}
              <textarea
                defaultValue={`Hi {client_name}, thank you for reaching out.\nYour message has been received and logged as {story_id}...`}
                disabled={!autoReplyEnabled}
                style={{
                  width: "100%",
                  border: `1px solid ${colors["border-default"]}`,
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                  fontSize: typography.bodySm.size,
                  height: 80,
                  marginBottom: spacing[4],
                  resize: "none",
                  boxSizing: "border-box",
                  backgroundColor: autoReplyEnabled
                    ? colors["surface-card"]
                    : colors["surface-subtle"],
                  color: colors["text-primary"],
                }}
              />

              {/* Save settings button */}
              <button type="button" style={primaryBtn}>
                Save Settings
              </button>
            </div>
          )}

          {/* ADO Setup content */}
          {activeSection === "ado-setup" && (
            <div>
              {/* Error card shown when tokenExpired is true */}
              {tokenExpired && (
                <div
                  style={{
                    backgroundColor: colors["danger-bg"], // Spec: bg #fee2e2
                    border: "1px solid #fca5a5", // Spec: border #fca5a5
                    borderRadius: borderRadius.lg, // Matches card rounding style
                    padding: spacing[4],
                    marginBottom: spacing[5],
                  }}
                >
                  <div style={{ display: "flex", gap: spacing[3], alignItems: "flex-start" }}>
                    <AlertTriangle size={20} color={colors.danger} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: colors.danger }}>
                        Connection Error — Token expired on 19 May
                      </div>
                      <ol style={{ margin: `${spacing[3]} 0 0 18px`, color: colors["text-secondary"], fontSize: typography.bodySm.size }}>
                        <li style={{ marginBottom: 6 }}>Go to Azure DevOps link</li>
                        <li style={{ marginBottom: 6 }}>Generate new Personal Access Token</li>
                        <li style={{ marginBottom: 6 }}>
                          Paste token input field +{" "}
                          <strong style={{ color: colors["text-primary"] }}>
                            Validate and Save
                          </strong>
                        </li>
                      </ol>
                      <div style={{ marginTop: spacing[4], display: "flex", gap: spacing[2], flexWrap: "wrap" }}>
                        <input
                          type="password"
                          placeholder="Paste new token…"
                          style={{
                            flex: 1,
                            minWidth: 240,
                            height: 40,
                            borderRadius: borderRadius.md,
                            border: `1px solid ${colors["border-default"]}`,
                            padding: `0 ${spacing[3]}`,
                            fontSize: typography.bodySm.size,
                          }}
                        />
                        <button
                          type="button"
                          style={primaryBtn}
                          onClick={() => setTokenExpired(false)}
                        >
                          Validate and Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Simple connected state when tokenExpired becomes false */}
              {!tokenExpired && (
                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: borderRadius.lg,
                    padding: spacing[4],
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[3],
                  }}
                >
                  <Check size={18} color={colors["success-dark"]} />
                  <div style={{ fontSize: "14px", fontWeight: 700, color: colors["text-primary"] }}>
                    Connected — token refreshed successfully
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Teams Setup content */}
          {activeSection === "teams-setup" && (
            <div
              style={{
                backgroundColor: colors["surface-card"],
                border: `1px solid ${colors["border-default"]}`,
                borderRadius: borderRadius.lg,
                padding: spacing[6],
                maxWidth: 520,
              }}
            >
              {/* Empty state logo placeholder */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors["surface-blue-tint"],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing[4],
                }}
                aria-hidden
              >
                🎥
              </div>

              <div style={{ fontSize: "20px", fontWeight: 700, color: colors["text-primary"] }}>
                Connect Microsoft Teams
              </div>

              <ul style={{ margin: `${spacing[4]} 0 0 18px`, color: colors["text-secondary"], fontSize: typography.bodySm.size }}>
                <li style={{ marginBottom: 6 }}>Sync meetings automatically</li>
                <li style={{ marginBottom: 6 }}>Extract action items & commitments</li>
                <li style={{ marginBottom: 6 }}>Generate stories from transcripts</li>
              </ul>

              <button
                type="button"
                style={{
                  marginTop: spacing[5],
                  width: "100%",
                  height: 40,
                  borderRadius: borderRadius.md,
                  border: "none",
                  backgroundColor: "#0f766e", // Spec teal
                  color: colors["text-on-dark"],
                  fontSize: typography.bodySm.size,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Connect Teams Now
              </button>
            </div>
          )}

          {/* All other sections show a small placeholder card for now */}
          {activeSection !== "slack-setup" &&
            activeSection !== "ado-setup" &&
            activeSection !== "teams-setup" && (
              <div
                style={{
                  backgroundColor: colors["surface-card"],
                  border: `1px solid ${colors["border-default"]}`,
                  borderRadius: borderRadius.md,
                  padding: spacing[5],
                  color: colors["text-secondary"],
                  fontSize: typography.bodySm.size,
                }}
              >
                {activeSection} settings coming soon.
              </div>
            )}
        </section>
      </div>
    </AppShell>
  );
}

// ── ChannelToggleRow — one row in the Client Channels list ───
//
// Props:
//   channel  — SlackChannelItem from the API
//   clients  — list of client options for the dropdown
//   onUpdate — called with the optimistically-updated channel (reverted on API error)

function ChannelToggleRow({
  channel,
  clients,
  onUpdate,
}: {
  channel: SlackChannelItem;
  clients: SlackClientOption[];
  onUpdate: (updated: SlackChannelItem) => void;
}) {
  const [saving, setSaving] = useState(false);

  // Toggle monitoring ON/OFF — optimistic update, revert on API error
  const toggle = async (isOn: boolean) => {
    const optimistic: SlackChannelItem = {
      ...channel,
      isClientChannel: isOn,
      // Clear client assignment when turning OFF so UI is clean
      clientId: isOn ? channel.clientId : null,
      clientName: isOn ? channel.clientName : null,
    };
    onUpdate(optimistic);
    setSaving(true);
    try {
      await updateSlackChannel(channel.id, {
        isClientChannel: isOn,
        clientId: isOn ? channel.clientId : null,
      });
    } catch {
      onUpdate(channel); // Revert optimistic update on failure
    } finally {
      setSaving(false);
    }
  };

  // Assign a client to the monitored channel
  const assignClient = async (clientId: string | null) => {
    const client = clients.find((c) => c.id === clientId) ?? null;
    const optimistic: SlackChannelItem = {
      ...channel,
      clientId,
      clientName: client?.name ?? null,
    };
    onUpdate(optimistic);
    setSaving(true);
    try {
      await updateSlackChannel(channel.id, {
        isClientChannel: channel.isClientChannel,
        clientId,
      });
    } catch {
      onUpdate(channel); // Revert on failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 180px 60px",
        alignItems: "center",
        padding: "0 16px",
        height: 52, // Spec: 52px row height
        borderBottom: `1px solid ${colors["border-default"]}`,
        opacity: saving ? 0.6 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* Channel name */}
      <span
        style={{
          fontSize: typography.bodySm.size,
          color: colors["text-primary"],
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        #{channel.channelName}
      </span>

      {/* Client dropdown — only visible when monitoring is ON */}
      {channel.isClientChannel ? (
        <select
          value={channel.clientId ?? ""}
          disabled={saving}
          onChange={(e) => assignClient(e.target.value || null)}
          style={{
            height: 32,
            borderRadius: borderRadius.sm,
            border: `1px solid ${colors["border-default"]}`,
            fontSize: typography.captionSm.size,
            padding: `0 ${spacing[2]}`,
            color: colors["text-primary"],
            background: colors["surface-card"],
            maxWidth: 168,
            width: "100%",
          }}
        >
          <option value="">— select client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <span style={{ fontSize: typography.captionSm.size, color: colors["text-tertiary"] }}>
          —
        </span>
      )}

      {/* Toggle switch — green when ON, gray when OFF */}
      <button
        type="button"
        disabled={saving}
        onClick={() => toggle(!channel.isClientChannel)}
        style={{
          width: 40,
          height: 22,
          borderRadius: borderRadius.full,
          border: "none",
          cursor: saving ? "not-allowed" : "pointer",
          backgroundColor: channel.isClientChannel
            ? colors.success // ON — green #10b981
            : colors["border-light"], // OFF — gray #cbd5e1
          position: "relative",
          flexShrink: 0,
        }}
        aria-label={`${channel.isClientChannel ? "Stop" : "Start"} monitoring #${channel.channelName}`}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: borderRadius.full,
            backgroundColor: colors["surface-card"],
            position: "absolute",
            top: 2,
            left: channel.isClientChannel ? 20 : 2, // Slide dot right when ON
            transition: "left 0.15s ease",
          }}
        />
      </button>
    </div>
  );
}

// ── Reusable table component (Slack Setup sections) ──────────

function SettingsTable({
  columns,
  rows,
  footerLink,
}: {
  columns: string[]; // Header cells in uppercase
  rows: (string | React.ReactNode)[][]; // Body cells
  footerLink: string; // Footer CTA link text
}) {
  return (
    <div
      style={{
        backgroundColor: colors["surface-card"],
        border: `1px solid ${colors["border-default"]}`,
        borderRadius: borderRadius.md,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          gap: spacing[3],
          padding: "10px 16px",
          backgroundColor: colors["surface-subtle"],
          borderBottom: `1px solid ${colors["border-default"]}`,
        }}
      >
        {columns.map((c) => (
          <span key={c} style={tableHeaderCell}>
            {c}
          </span>
        ))}
      </div>

      {/* Body rows */}
      {rows.map((cells, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            gap: spacing[3],
            padding: "12px 16px",
            borderBottom: `1px solid ${colors["border-default"]}`,
            fontSize: typography.bodySm.size,
            color: colors["text-secondary"],
          }}
        >
          {cells.map((cell, idx) => (
            <span key={idx} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cell}
            </span>
          ))}
        </div>
      ))}

      {/* Footer row link */}
      <div style={{ padding: "10px 16px" }}>
        <button type="button" style={linkBtn}>
          {footerLink}
        </button>
      </div>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────

const subnavSectionLabel: CSSProperties = {
  padding: "10px 16px 4px",
  fontSize: typography.captionSm.size,
  fontWeight: 600,
  textTransform: "uppercase",
  color: colors["text-tertiary"],
};

const subnavItem: CSSProperties = {
  height: "36px",
  width: "100%",
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  border: "none",
  background: "transparent",
  cursor: "pointer",
  boxSizing: "border-box",
};

const sectionTitle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: colors["text-primary"],
  marginBottom: spacing[2],
};

const tableHeaderCell: CSSProperties = {
  fontSize: typography.tableHeader.size,
  fontWeight: typography.tableHeader.weight,
  color: colors["text-tertiary"],
  textTransform: "uppercase",
};

const linkBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: colors["brand-blue"],
  fontSize: typography.bodySm.size,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  height: 36,
  padding: `0 ${spacing[3]}`,
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.md,
  background: "transparent",
  color: colors["text-secondary"],
  fontSize: typography.captionSm.size,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const disconnectBtn: CSSProperties = {
  ...ghostBtn,
  border: "1px solid #fca5a5",
  color: colors.danger,
};

const primaryBtn: CSSProperties = {
  height: 40,
  padding: `0 ${spacing[4]}`,
  borderRadius: borderRadius.md,
  border: "none",
  backgroundColor: colors["brand-blue"],
  color: colors["text-on-dark"],
  fontSize: typography.bodySm.size,
  fontWeight: 700,
  cursor: "pointer",
};

