// ─────────────────────────────────────────────
// SettingsPage - workspace and integration configuration
// Built to match DeliveryPulse Figma "Settings" layout + user specs
// ─────────────────────────────────────────────

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Slack } from "lucide-react"; // Icons for status/error affordances - consistent with the app icon set
import AppShell from "../../components/layout/AppShell";
import {
  disconnectSlackWorkspace,
  getSlackChannels,
  getSlackStatus,
  getSlackWorkspaces,
  getSlackConnectInit,
  switchSlackWorkspace,
  updateSlackChannel,
  type SlackChannelItem,
  type SlackClientOption,
  type SlackWorkspaceSummary,
} from "../../api/slack.integration.api";
import api from "../../api/axios";
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
  icon: string; // Emoji icon per spec - simple, designer-friendly
}

interface RoleRow {
  name: string; // Person name
  username: string; // Slack username
  role: string; // Team role label
}

interface AdoConnectionItem {
  _id: string;
  name: string;
  adoOrg: string;
  adoProject: string;
  patTokenPreview?: string;
  isDefault: boolean;
  connectionStatus: "connected" | "failed" | "pending";
  lastTestedAt?: string;
  workItemTypes?: string[];
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

// ── Static data (role mapping only - channels loaded from API) ────────────────

const roleMapping: RoleRow[] = [
  { name: "Vijay M", username: "@vijay.m", role: "Project Manager" },
  { name: "Sneha N", username: "@sneha.n", role: "Business Analyst" },
  { name: "Deepak K", username: "@deepak.k", role: "Developer" },
]; // Table rows per spec - maps Slack users to roles

// ── Page component ───────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    location.pathname.includes("/settings/slack") ? "slack-setup" : "slack-setup",
  );

  const [slackNotice, setSlackNotice] = useState<string | null>(null);
  const [slackWorkspaces, setSlackWorkspaces] = useState<SlackWorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  // ── Real channel data loaded from API ───────────────────────
  const [channels, setChannels] = useState<SlackChannelItem[]>([]);
  const [clients, setClients] = useState<SlackClientOption[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState(
    () => localStorage.getItem("teams-webhook-url") || "",
  );
  const [adoConnections, setAdoConnections] = useState<AdoConnectionItem[]>([]);
  const [showAddAdo, setShowAddAdo] = useState(false);
  const [adoForm, setAdoForm] = useState({
    name: "",
    adoOrg: "",
    adoProject: "",
    patToken: "",
  });
  const [isAddingAdo, setIsAddingAdo] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchAdoConnections = async () => {
    try {
      const response = await api.get("/ado-connections");
      setAdoConnections(response.data.connections || []);
    } catch (error) {
      console.error("Failed to fetch ADO connections:", error);
    }
  };

  const handleAddAdoConnection = async () => {
    if (!adoForm.name || !adoForm.adoOrg || !adoForm.adoProject || !adoForm.patToken) {
      alert("Please fill in all fields");
      return;
    }

    setIsAddingAdo(true);
    try {
      const response = await api.post("/ado-connections", adoForm);
      alert(response.data.message);
      setAdoForm({ name: "", adoOrg: "", adoProject: "", patToken: "" });
      setShowAddAdo(false);
      fetchAdoConnections();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to add connection: ${msg}`);
    } finally {
      setIsAddingAdo(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const response = await api.post(`/ado-connections/${id}/test`);
      alert(response.data.message);
      fetchAdoConnections();
    } catch {
      alert("Test failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await api.patch(`/ado-connections/${id}/set-default`);
      alert(response.data.message);
      fetchAdoConnections();
    } catch {
      alert("Failed to set default");
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!window.confirm("Remove this ADO connection?")) return;
    try {
      await api.delete(`/ado-connections/${id}`);
      fetchAdoConnections();
    } catch {
      alert("Failed to remove connection");
    }
  };

  const handleSaveTeamsWebhook = async () => {
    try {
      localStorage.setItem("teams-webhook-url", teamsWebhookUrl);
      await api.post("/settings/teams-webhook", {
        webhookUrl: teamsWebhookUrl,
      });
      alert("✅ Teams webhook saved successfully");
    } catch {
      localStorage.setItem("teams-webhook-url", teamsWebhookUrl);
      alert("✅ Teams webhook saved locally (restart backend or set TEAMS_WEBHOOK_URL on Render for production)");
    }
  };

  const slackConnected = slackWorkspaces.length > 0;
  const activeWorkspace = slackWorkspaces.find((w) => w.id === activeWorkspaceId) ?? slackWorkspaces[0] ?? null;

  // loadChannels - fetch channels + clients for the given workspace
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
    setWorkspacesLoading(true);
    Promise.all([getSlackStatus(), getSlackWorkspaces()])
      .then(([s, workspaces]) => {
        setSlackWorkspaces(workspaces);
        const wsId = activeWorkspaceId ?? workspaces[0]?.id ?? null;
        if (!activeWorkspaceId && workspaces[0]?.id) {
          setActiveWorkspaceId(workspaces[0].id);
        }
        if (s.connected && wsId) {
          loadChannels(wsId);
        }
      })
      .catch(() => {})
      .finally(() => setWorkspacesLoading(false));
  };

  useEffect(() => {
    loadSlackStatus();
  }, []);

  // When the user finishes OAuth in the new tab and switches back to this tab,
  // reload the workspace list automatically so the new workspace appears.
  useEffect(() => {
    const onFocus = () => {
      if (activeSection === "slack-setup") loadSlackStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [activeSection]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const slackConnected = searchParams.get("slack_connected");
    const workspace = searchParams.get("workspace");
    if (connected === "true" || slackConnected === "true" || searchParams.get("slack") === "connected") {
      const wsId = searchParams.get("workspaceId");
      if (wsId) setActiveWorkspaceId(wsId);
      setSlackNotice(`Slack connected${workspace ? ` to ${workspace}` : ""}.`);
      navigate("/settings", { replace: true });
      loadSlackStatus();
    }
    if (connected === "false" || slackConnected === "false" || searchParams.get("error")) {
      const message = searchParams.get("error") ?? searchParams.get("message");
      setSlackNotice(
        message ? `Slack connection failed: ${message}` : "Slack connection failed.",
      );
      navigate("/settings", { replace: true });
    }
  }, [searchParams, navigate]);

  const handleConnectSlack = async () => {
    try {
      const connectUrl = await getSlackConnectInit("settings");
      // Open in a new tab so Slack's workspace-picker JavaScript
      // runs in a clean browsing context (avoids workspace dropdown issues).
      window.open(connectUrl, "_blank", "noopener,noreferrer");
    } catch {
      setSlackNotice("Failed to connect Slack. Please try again.");
    }
  };

  const handleDisconnectWorkspace = async (wsId: string) => {
    try {
      await disconnectSlackWorkspace(wsId);
      setSlackWorkspaces((prev) => prev.filter((w) => w.id !== wsId));
      if (activeWorkspaceId === wsId) {
        const remaining = slackWorkspaces.filter((w) => w.id !== wsId);
        const next = remaining[0]?.id ?? null;
        setActiveWorkspaceId(next);
        if (next) loadChannels(next);
        else { setChannels([]); setClients([]); }
      }
      setSlackNotice("Workspace disconnected.");
    } catch {
      setSlackNotice("Could not disconnect workspace.");
    }
  };

  const handleSwitchWorkspace = async (wsId: string) => {
    setActiveWorkspaceId(wsId);
    try {
      await switchSlackWorkspace(wsId);
    } catch { /* best-effort */ }
    loadChannels(wsId);
  };

  // autoReplyEnabled - toggles the auto-reply switch and the textarea enablement
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true); // ON state by default - aligns with typical setup flows

  // tokenExpired - removed; ADO connections loaded from API

  useEffect(() => {
    fetchAdoConnections();
  }, []);

  // Current nav lists - grouped by section label to match your left-nav spec
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
  ); // navGroups is static - memo keeps referential stability

  // Right-panel title/subtitle - changes based on the selected section
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
        sub: "Connect multiple ADO organizations and projects",
      };
    }
    if (activeSection === "teams-setup") {
      return {
        title: "Microsoft Teams Integration",
        sub: "Get notified in Teams when stories are assigned to developers",
      };
    }
    return {
      title: "Settings",
      sub: "Manage your workspace configuration",
    };
  }, [activeSection]); // Recompute when active section changes

  return (
    <AppShell pageTitle="Settings">
      {/* Full-bleed split layout - cancels AppShell 24px padding */}
      <div
        style={{
          margin: `-${spacing[6]}`, // Removes AppShell padding so the sub-nav touches the edge like Figma
          height: "calc(100vh - 60px)", // Spec: height calc(100vh - 60px)
          display: "flex", // Two panel layout
          overflow: "hidden", // Prevents body scroll - right panel handles its own scrolling
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

              {/* ── NO WORKSPACE STATE ───────────────────────── */}
              {!workspacesLoading && !slackConnected && (
                <div
                  style={{
                    backgroundColor: colors["surface-card"],
                    border: `1px solid ${colors["border-default"]}`,
                    borderRadius: borderRadius.lg,
                    padding: spacing[6],
                    maxWidth: 520,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: borderRadius.full,
                      backgroundColor: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: `0 auto ${spacing[4]}`,
                    }}
                  >
                    <Slack size={28} color="#1c2655" />
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: colors["text-primary"], marginBottom: spacing[2] }}>
                    Connect your Slack workspace
                  </div>
                  <div style={{ fontSize: typography.bodySm.size, color: colors["text-secondary"], marginBottom: spacing[4] }}>
                    Ingest client messages, extract work items with AI, and manage your Review Queue — all from Slack.
                  </div>
                  <div
                    style={{
                      backgroundColor: colors.canvas,
                      border: `1px solid ${colors["border-default"]}`,
                      borderRadius: borderRadius.md,
                      padding: spacing[4],
                      marginBottom: spacing[5],
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 600, color: colors["text-primary"], marginBottom: spacing[2] }}>
                      What gets connected:
                    </div>
                    {["Client channels you select", "AI story extraction from messages", "Auto-reply acknowledgements"].map((item) => (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: 6 }}>
                        <Check size={14} color={colors["success-dark"]} />
                        <span style={{ fontSize: typography.bodySm.size, color: colors["text-secondary"] }}>{item}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" style={{ ...primaryBtn, width: "100%" }} onClick={handleConnectSlack}>
                    Connect Slack Workspace
                  </button>
                </div>
              )}

              {/* ── CONNECTED STATE ──────────────────────────── */}
              {slackConnected && (
                <>
                  {/* WORKSPACE SWITCHER — show only when 2+ workspaces */}
                  {slackWorkspaces.length >= 2 && (
                    <div style={{ marginBottom: spacing[5] }}>
                      <div
                        style={{
                          fontSize: "12px",
                          color: colors["text-tertiary"],
                          marginBottom: spacing[2],
                          fontWeight: 500,
                        }}
                      >
                        Your Workspaces
                      </div>
                      <select
                        value={activeWorkspace?.id ?? ""}
                        onChange={(e) => handleSwitchWorkspace(e.target.value)}
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: "8px",
                          border: `1px solid ${colors["border-default"]}`,
                          backgroundColor: colors["surface-card"],
                          fontSize: typography.bodySm.size,
                          padding: `0 ${spacing[3]}`,
                          color: colors["text-primary"],
                          cursor: "pointer",
                        }}
                      >
                        {slackWorkspaces.map((ws) => (
                          <option key={ws.id} value={ws.id}>
                            {ws.teamName} — Connected {formatRelativeDate(ws.connectedAt)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ADD ANOTHER WORKSPACE button */}
                  <button
                    type="button"
                    style={{
                      ...ghostBtn,
                      marginBottom: spacing[5],
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[2],
                    }}
                    onClick={handleConnectSlack}
                  >
                    + Add Another Workspace
                  </button>

                  {/* CONNECTED WORKSPACE CARDS */}
                  <div style={{ marginBottom: spacing[5] }}>
                    {slackWorkspaces.map((ws) => (
                      <div
                        key={ws.id}
                        style={{
                          backgroundColor: "#f0fdf4",
                          border: `1px solid #bbf7d0`,
                          borderRadius: borderRadius.lg,
                          padding: spacing[4],
                          marginBottom: spacing[3],
                          display: "flex",
                          alignItems: "center",
                          gap: spacing[3],
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: borderRadius.full,
                            backgroundColor: "#dcfce7",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={18} color={colors["success-dark"]} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: 2 }}>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: colors["text-primary"] }}>
                              {ws.teamName}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: colors["success-dark"],
                                backgroundColor: "#dcfce7",
                                borderRadius: "4px",
                                padding: "1px 6px",
                              }}
                            >
                              Connected
                            </span>
                          </div>
                          <div style={{ fontSize: typography.captionSm.size, color: colors["text-secondary"] }}>
                            Connected {formatRelativeDate(ws.connectedAt)} · {ws.channelCount} channel{ws.channelCount !== 1 ? "s" : ""} available
                          </div>
                        </div>

                        <button
                          type="button"
                          style={disconnectBtn}
                          onClick={() => handleDisconnectWorkspace(ws.id)}
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* CHANNELS SECTION */}
                  <div style={{ marginBottom: spacing[5] }}>
                    <div style={{ marginBottom: spacing[2] }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: colors["text-primary"], marginBottom: 4 }}>
                        Select Client Channels
                      </div>
                      <div style={{ fontSize: typography.bodySm.size, color: colors["text-secondary"] }}>
                        Choose which channels contain client messages
                      </div>
                    </div>

                    {/* Search box */}
                    <input
                      type="text"
                      placeholder="Search channels…"
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: borderRadius.md,
                        border: `1px solid ${colors["border-default"]}`,
                        padding: `0 ${spacing[3]}`,
                        fontSize: typography.bodySm.size,
                        marginBottom: spacing[3],
                        boxSizing: "border-box",
                        backgroundColor: colors["surface-card"],
                        color: colors["text-primary"],
                      }}
                    />

                    {/* Loading state */}
                    {channelsLoading && (
                      <div style={{ padding: spacing[4], color: colors["text-secondary"], fontSize: typography.bodySm.size }}>
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
                        <button
                          type="button"
                          style={{ ...ghostBtn, display: "block", margin: `${spacing[3]} auto 0` }}
                          onClick={() => activeWorkspace && loadChannels(activeWorkspace.id)}
                        >
                          Refresh
                        </button>
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
                            gridTemplateColumns: "1fr 100px 180px 60px",
                            padding: "10px 16px",
                            backgroundColor: colors["surface-subtle"],
                            borderBottom: `1px solid ${colors["border-default"]}`,
                          }}
                        >
                          <span style={tableHeaderCell}>CHANNEL</span>
                          <span style={tableHeaderCell}>MEMBERS</span>
                          <span style={tableHeaderCell}>CLIENT</span>
                          <span style={tableHeaderCell}>MONITOR</span>
                        </div>

                        {channels
                          .filter((ch) =>
                            channelSearch === "" ||
                            ch.channelName.toLowerCase().includes(channelSearch.toLowerCase()),
                          )
                          .map((ch) => (
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

                  {/* SECTION - Team Role Mapping */}
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

                  {/* SECTION - Auto-Reply Settings */}
                  <div style={{ ...sectionTitle, marginTop: spacing[5] }}>Auto-Reply Settings</div>
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
                    <button
                      type="button"
                      onClick={() => setAutoReplyEnabled((v) => !v)}
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: borderRadius.full,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: autoReplyEnabled ? colors.success : colors["border-light"],
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
                          left: autoReplyEnabled ? 20 : 2,
                          transition: "left 0.15s ease",
                        }}
                      />
                    </button>
                  </div>
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
                      backgroundColor: autoReplyEnabled ? colors["surface-card"] : colors["surface-subtle"],
                      color: colors["text-primary"],
                    }}
                  />
                  <button type="button" style={primaryBtn}>
                    Save Settings
                  </button>
                </>
              )}
            </div>
          )}

          {/* ADO Setup content */}
          {activeSection === "ado-setup" && (
            <div style={{ marginBottom: 32, maxWidth: 900 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 12,
              }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Azure DevOps Integration
                  </h2>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                    Connect multiple ADO organizations and projects
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAdo(!showAddAdo)}
                  style={{
                    backgroundColor: "#0078d4",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add Connection
                </button>
              </div>

              {showAddAdo && (
                <div style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 24,
                  marginBottom: 16,
                }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>
                    Add New ADO Connection
                  </h3>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 16,
                    marginBottom: 16,
                  }}>
                    <div>
                      <label style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}>
                        Connection Name *
                      </label>
                      <input
                        value={adoForm.name}
                        onChange={(e) => setAdoForm({ ...adoForm, name: e.target.value })}
                        placeholder="e.g. Main Project ADO"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 14,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}>
                        ADO Organization *
                      </label>
                      <input
                        value={adoForm.adoOrg}
                        onChange={(e) => setAdoForm({ ...adoForm, adoOrg: e.target.value })}
                        placeholder="e.g. kamal02211994"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 14,
                          boxSizing: "border-box",
                        }}
                      />
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
                        From: dev.azure.com/YOUR_ORG
                      </p>
                    </div>

                    <div>
                      <label style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}>
                        ADO Project Name *
                      </label>
                      <input
                        value={adoForm.adoProject}
                        onChange={(e) => setAdoForm({ ...adoForm, adoProject: e.target.value })}
                        placeholder="e.g. Delivery pulse"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 14,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}>
                        Personal Access Token (PAT) *
                      </label>
                      <input
                        type="password"
                        value={adoForm.patToken}
                        onChange={(e) => setAdoForm({ ...adoForm, patToken: e.target.value })}
                        placeholder="Paste your PAT token here"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 14,
                          boxSizing: "border-box",
                        }}
                      />
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
                        Required scope: Work Items → Read & Write
                      </p>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: "#eff6ff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 16,
                    fontSize: 13,
                    color: "#1d4ed8",
                  }}>
                    💡 Connection will be tested automatically when added.
                    First connection is set as default.
                  </div>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleAddAdoConnection}
                      disabled={isAddingAdo}
                      style={{
                        backgroundColor: isAddingAdo ? "#94a3b8" : "#0078d4",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "10px 20px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isAddingAdo ? "not-allowed" : "pointer",
                      }}
                    >
                      {isAddingAdo ? "⏳ Testing & Adding..." : "+ Add & Test Connection"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAdo(false)}
                      style={{
                        backgroundColor: "white",
                        color: "#64748b",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "10px 20px",
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {adoConnections.length === 0 ? (
                <div style={{
                  backgroundColor: "white",
                  border: "2px dashed #e2e8f0",
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: 0 }}>
                    No ADO connections yet
                  </p>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: "8px 0 16px" }}>
                    Add your Azure DevOps organization to start pushing stories
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddAdo(true)}
                    style={{
                      backgroundColor: "#0078d4",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Add First Connection
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {adoConnections.map((conn) => (
                    <div
                      key={conn._id}
                      style={{
                        backgroundColor: "white",
                        border: `1px solid ${conn.isDefault ? "#93c5fd" : "#e2e8f0"}`,
                        borderRadius: 12,
                        padding: "16px 20px",
                        borderLeft: `4px solid ${
                          conn.connectionStatus === "connected" ? "#16a34a"
                            : conn.connectionStatus === "failed" ? "#dc2626"
                              : "#f59e0b"
                        }`,
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 6,
                            flexWrap: "wrap",
                          }}>
                            <h3 style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#0f172a",
                              margin: 0,
                            }}>
                              {conn.name}
                            </h3>

                            {conn.isDefault && (
                              <span style={{
                                backgroundColor: "#eff6ff",
                                color: "#2563eb",
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                              }}>
                                ⭐ Default
                              </span>
                            )}

                            <span style={{
                              backgroundColor: conn.connectionStatus === "connected"
                                ? "#f0fdf4"
                                : conn.connectionStatus === "failed"
                                  ? "#fef2f2"
                                  : "#fffbeb",
                              color: conn.connectionStatus === "connected"
                                ? "#16a34a"
                                : conn.connectionStatus === "failed"
                                  ? "#dc2626"
                                  : "#f59e0b",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                            }}>
                              {conn.connectionStatus === "connected" ? "✅ Connected"
                                : conn.connectionStatus === "failed" ? "❌ Failed"
                                  : "⏳ Pending"}
                            </span>
                          </div>

                          <div style={{
                            display: "flex",
                            gap: 16,
                            fontSize: 13,
                            color: "#64748b",
                            flexWrap: "wrap",
                          }}>
                            <span>🏢 {conn.adoOrg}</span>
                            <span>📁 {conn.adoProject}</span>
                            <span>🔑 {conn.patTokenPreview}</span>
                            {conn.lastTestedAt && (
                              <span>
                                🕐 Tested {new Date(conn.lastTestedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {(conn.workItemTypes?.length ?? 0) > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                                Work item types: {conn.workItemTypes?.join(", ")}
                              </span>
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                          {!conn.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(conn._id)}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#eff6ff",
                                color: "#2563eb",
                                border: "1px solid #93c5fd",
                                borderRadius: 6,
                                fontSize: 12,
                                cursor: "pointer",
                                fontWeight: 500,
                              }}
                            >
                              Set Default
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTestConnection(conn._id)}
                            disabled={testingId === conn._id}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#f0fdf4",
                              color: "#16a34a",
                              border: "1px solid #86efac",
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            {testingId === conn._id ? "⏳" : "🔄 Test"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteConnection(conn._id)}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "white",
                              color: "#dc2626",
                              border: "1px solid #fca5a5",
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Teams Setup content */}
          {activeSection === "teams-setup" && (
            <div style={{ maxWidth: 640 }}>
              <div style={{
                backgroundColor: colors["surface-card"],
                border: `1px solid ${colors["border-default"]}`,
                borderRadius: borderRadius.lg,
                padding: spacing[6],
              }}>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 32 }}>💼</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                      Teams Webhook
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                      Get notified in Teams when stories are assigned to developers
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    display: "block",
                    marginBottom: 6,
                  }}>
                    Incoming Webhook URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://outlook.office.com/webhook/..."
                    value={teamsWebhookUrl}
                    onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "#64748b",
                }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
                    How to get webhook URL:
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Open Microsoft Teams</li>
                    <li>Go to the notification channel</li>
                    <li>Click ... → Connectors</li>
                    <li>Configure Incoming Webhook</li>
                    <li>Copy and paste the URL here</li>
                  </ol>
                  <p style={{ margin: "12px 0 0", fontSize: 12 }}>
                    For production, also add <strong>TEAMS_WEBHOOK_URL</strong> to Render environment variables.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTeamsWebhook}
                  style={{
                    backgroundColor: "#6264a7",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save Teams Webhook
                </button>
              </div>
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

// ── ChannelToggleRow - one row in the Client Channels list ───
//
// Props:
//   channel  - SlackChannelItem from the API
//   clients  - list of client options for the dropdown
//   onUpdate - called with the optimistically-updated channel (reverted on API error)

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

  // Toggle monitoring ON/OFF - optimistic update, revert on API error
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
        gridTemplateColumns: "1fr 100px 180px 60px",
        alignItems: "center",
        padding: "0 16px",
        height: 52,
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

      {/* Member count */}
      <span style={{ fontSize: typography.captionSm.size, color: colors["text-tertiary"] }}>
        {channel.memberCount != null ? channel.memberCount : "—"}
      </span>

      {/* Client dropdown - only visible when monitoring is ON */}
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
          <option value="">- select client -</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <span style={{ fontSize: typography.captionSm.size, color: colors["text-tertiary"] }}>
          -
        </span>
      )}

      {/* Toggle switch - green when ON, gray when OFF */}
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
            ? colors.success // ON - green #10b981
            : colors["border-light"], // OFF - gray #cbd5e1
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

