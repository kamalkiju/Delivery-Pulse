// ─────────────────────────────────────────────────────────────────────────────
// OnboardingSlackStep — Step 3: multi-workspace Slack OAuth + channel mapping
//
// API calls:
//   GET  /api/slack/workspaces              → workspaces list
//   GET  /api/slack/workspaces/:id/channels → channel list + clients
//   PATCH /api/slack/channels/:id           → toggle client channel + map client
//   GET  /api/slack/connect                 → OAuth (browser redirect)
//   DELETE /api/slack/workspaces/:id        → disconnect one workspace
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Check, Plus, Slack } from "lucide-react";
import api from "../../api/axios"; // Shared axios instance — baseURL is already VITE_API_URL/api
import { getAllClients } from "../../api/clients.api";
import {
  disconnectSlackWorkspace,
  getSlackWorkspaces,
  getWorkspaceChannels,
  updateSlackChannel,
  type SlackChannelItem,
  type SlackClientOption,
  type SlackWorkspaceSummary,
} from "../../api/slack.integration.api";
import { borderRadius, colors, spacing, typography } from "../../styles/tokens";

interface OnboardingSlackStepProps {
  /** Set after OAuth redirect (?slack=connected or ?connected=true) */
  oauthSuccess?: boolean;
  oauthTeamName?: string | null;
  workspaceId?: string | null;
  onConnectionChange?: (connected: boolean) => void;
}

const CONNECT_BULLETS = [
  "Read messages from channels you select",
  "Identify which messages are from clients",
  "Create ADO stories from client messages automatically",
  "Send acknowledgement replies to clients",
] as const;

export default function OnboardingSlackStep({
  oauthSuccess,
  oauthTeamName,
  workspaceId: workspaceIdProp,
  onConnectionChange,
}: OnboardingSlackStepProps) {
  // workspaces — GET /api/slack/workspaces
  const [workspaces, setWorkspaces] = useState<SlackWorkspaceSummary[]>([]);
  // channels — GET /api/slack/workspaces/:activeWorkspaceId/channels
  const [channels, setChannels] = useState<SlackChannelItem[]>([]);
  const [clients, setClients] = useState<SlackClientOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    workspaceIdProp ?? null,
  );

  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingChannelId, setSavingChannelId] = useState<string | null>(null);

  const hasWorkspaces = workspaces.length > 0;

  /** Fetch all connected workspaces for this organisation */
  const loadWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    setError(null);
    try {
      const list = await getSlackWorkspaces();
      setWorkspaces(list);
      onConnectionChange?.(list.length > 0);

      setActiveWorkspaceId((current) => {
        if (current && list.some((w) => w.id === current)) return current;
        if (workspaceIdProp && list.some((w) => w.id === workspaceIdProp)) {
          return workspaceIdProp;
        }
        return list[0]?.id ?? null;
      });
    } catch {
      setError("Could not load Slack workspaces.");
      onConnectionChange?.(false);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, [onConnectionChange, workspaceIdProp]);

  /** Fetch channels for the active workspace */
  const loadChannels = useCallback(async (workspaceId: string) => {
    setIsLoadingChannels(true);
    try {
      const { channels: list, clients: fromApi } =
        await getWorkspaceChannels(workspaceId);
      setChannels(list);

      let clientList = fromApi;
      if (clientList.length === 0) {
        try {
          const all = await getAllClients();
          clientList = all.map((c) => ({
            id: c.id,
            name: c.name,
            company: "",
          }));
        } catch {
          /* use empty */
        }
      }
      setClients(clientList);
    } catch {
      setError("Could not load channels for this workspace.");
      setChannels([]);
    } finally {
      setIsLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (oauthSuccess || oauthTeamName) {
      setSuccessBanner(
        oauthTeamName
          ? `Successfully connected ${oauthTeamName}`
          : "Successfully connected your Slack workspace",
      );
    }
  }, [oauthSuccess, oauthTeamName]);

  useEffect(() => {
    if (activeWorkspaceId && hasWorkspaces) {
      loadChannels(activeWorkspaceId);
    }
  }, [activeWorkspaceId, hasWorkspaces, loadChannels]);

  useEffect(() => {
    if (workspaceIdProp) {
      setActiveWorkspaceId(workspaceIdProp);
    }
  }, [workspaceIdProp]);

  // Step 1: GET /api/slack/connect-init — authenticated (axios adds JWT header automatically)
  // Step 2: redirect browser to the one-time connect URL returned by the backend
  // No token is ever appended to the URL manually.
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await api.get("/slack/connect-init");
      // Open in new tab — keeps Slack's workspace picker working correctly
      window.open(response.data.connectUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to initiate Slack connect:", error);
      setIsConnecting(false);
      setError("Failed to connect Slack. Please try again.");
    }
  };

  const handleDisconnect = async (workspaceId: string) => {
    try {
      await disconnectSlackWorkspace(workspaceId);
      await loadWorkspaces();
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(null);
        setChannels([]);
      }
    } catch {
      setError("Could not disconnect workspace.");
    }
  };

  const handleToggleChannel = async (
    ch: SlackChannelItem,
    enabled: boolean,
  ) => {
    setSavingChannelId(ch.id);
    try {
      await updateSlackChannel(ch.id, {
        isClientChannel: enabled,
        clientId: enabled ? ch.clientId : null,
      });
      await loadChannels(activeWorkspaceId!);
      await loadWorkspaces();
    } catch {
      setError("Could not update channel.");
    } finally {
      setSavingChannelId(null);
    }
  };

  const handleClientMap = async (ch: SlackChannelItem, clientId: string) => {
    if (!clientId) return;
    setSavingChannelId(ch.id);
    try {
      await updateSlackChannel(ch.id, {
        isClientChannel: true,
        clientId,
      });
      await loadChannels(activeWorkspaceId!);
      await loadWorkspaces();
    } catch {
      setError("Could not save client mapping.");
    } finally {
      setSavingChannelId(null);
    }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  if (isLoadingWorkspaces) {
    return (
      <p style={{ color: colors["text-secondary"], fontSize: typography.bodySm.size }}>
        Loading Slack workspaces…
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {successBanner != null && (
        <div
          role="status"
          style={{
            padding: spacing[4],
            borderRadius: borderRadius.md,
            backgroundColor: colors["success-bg"],
            border: `1px solid ${colors["success-dark"]}33`,
            fontSize: typography.bodySm.size,
            fontWeight: 600,
            color: colors["success-dark"],
          }}
        >
          {successBanner}
        </div>
      )}

      {error != null && (
        <p style={{ margin: 0, color: colors.danger, fontSize: typography.bodySm.size }}>
          {error}
        </p>
      )}

      {/* ── SUB-SECTION 1: Connect Workspace ───────────────────────────────── */}
      <section>
        <h2
          style={{
            margin: `0 0 ${spacing[4]} 0`,
            fontSize: typography.bodyMd.size,
            fontWeight: 700,
            color: colors["text-primary"],
          }}
        >
          Connect workspace
        </h2>

        {!hasWorkspaces ? (
          <ConnectWorkspaceEmpty
            isConnecting={isConnecting}
            onConnect={handleConnect}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                isActive={ws.id === activeWorkspaceId}
                onSelect={() => setActiveWorkspaceId(ws.id)}
                onDisconnect={() => handleDisconnect(ws.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── SUB-SECTION 2: Channel Setup (after at least one workspace) ───── */}
      {hasWorkspaces && activeWorkspaceId != null && (
        <section>
          <h2
            style={{
              margin: `0 0 ${spacing[1]} 0`,
              fontSize: "16px",
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            Select client channels
          </h2>
          <p
            style={{
              margin: `0 0 ${spacing[4]} 0`,
              fontSize: "13px",
              color: colors["text-tertiary"],
            }}
          >
            Choose which channels contain client messages
            {activeWorkspace ? ` — ${activeWorkspace.teamName}` : ""}
          </p>

          {isLoadingChannels ? (
            <p style={{ fontSize: typography.bodySm.size, color: colors["text-secondary"] }}>
              Loading channels…
            </p>
          ) : (
            <ChannelList
              channels={channels}
              clients={clients}
              savingChannelId={savingChannelId}
              onToggle={handleToggleChannel}
              onClientSelect={handleClientMap}
            />
          )}

          <p
            style={{
              margin: `${spacing[3]} 0 0 0`,
              fontSize: typography.captionSm.size,
              color: colors["text-tertiary"],
            }}
          >
            Bot will join selected channels automatically
          </p>
        </section>
      )}

      {/* ── SUB-SECTION 3: Workspace switcher (multiple workspaces) ───────── */}
      {workspaces.length > 1 && (
        <section>
          <h2
            style={{
              margin: `0 0 ${spacing[3]} 0`,
              fontSize: "14px",
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            Your workspaces
          </h2>
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelect={setActiveWorkspaceId}
            onAddWorkspace={handleConnect}
            isConnecting={isConnecting}
          />
        </section>
      )}

      {hasWorkspaces && workspaces.length === 1 && (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          style={addWorkspaceBtnStyle}
        >
          <Plus size={16} />
          {isConnecting ? "Opening Slack…" : "Add another workspace"}
        </button>
      )}
    </div>
  );
}

// ── Sub-section 1: empty state ───────────────────────────────────────────────

function ConnectWorkspaceEmpty({
  isConnecting,
  onConnect,
}: {
  isConnecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: spacing[4] }}>
        <Slack size={56} color={colors["text-tertiary"]} aria-hidden />
      </div>
      <h3
        style={{
          margin: `0 0 ${spacing[2]} 0`,
          fontSize: "22px",
          fontWeight: 700,
          color: colors["text-primary"],
        }}
      >
        Connect your Slack workspace
      </h3>
      <p
        style={{
          margin: `0 0 ${spacing[5]} 0`,
          fontSize: typography.bodySm.size,
          color: colors["text-tertiary"],
          lineHeight: 1.5,
        }}
      >
        DeliveryPulse will monitor client messages automatically
      </p>

      <div
        style={{
          textAlign: "left",
          backgroundColor: colors["surface-subtle"],
          borderRadius: borderRadius.md,
          padding: spacing[4],
          marginBottom: spacing[5],
        }}
      >
        <p
          style={{
            margin: `0 0 ${spacing[3]} 0`,
            fontSize: typography.bodySm.size,
            fontWeight: 600,
            color: colors["text-primary"],
          }}
        >
          When you connect Slack, DeliveryPulse will:
        </p>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: spacing[2],
          }}
        >
          {CONNECT_BULLETS.map((line) => (
            <li
              key={line}
              style={{
                display: "flex",
                gap: spacing[2],
                fontSize: typography.bodySm.size,
                color: colors["text-secondary"],
              }}
            >
              <Check size={16} color={colors["success-dark"]} style={{ flexShrink: 0 }} />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onConnect}
        disabled={isConnecting}
        style={{
          width: "100%",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[2],
          borderRadius: borderRadius.md,
          border: "none",
          backgroundColor: colors["brand-blue"],
          color: colors["text-on-dark"],
          fontSize: typography.bodySm.size,
          fontWeight: 600,
          cursor: isConnecting ? "wait" : "pointer",
        }}
      >
        <Slack size={18} aria-hidden />
        {isConnecting ? "Opening Slack…" : "Connect Slack Workspace"}
      </button>
    </div>
  );
}

// ── Workspace card ───────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  isActive,
  onSelect,
  onDisconnect,
}: {
  workspace: SlackWorkspaceSummary;
  isActive: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  const connectedLabel = workspace.connectedAt
    ? new Date(workspace.connectedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
        padding: spacing[4],
        backgroundColor: colors["surface-card"],
        border: `1px solid ${isActive ? colors["brand-blue"] : colors["border-default"]}`,
        borderRadius: borderRadius.md,
        cursor: "pointer",
        boxShadow: isActive ? `0 0 0 1px ${colors["brand-blue"]}` : undefined,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: borderRadius.full,
          backgroundColor: colors["surface-subtle"],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {workspace.teamIcon ? (
          <img src={workspace.teamIcon} alt="" width={36} height={36} />
        ) : (
          <Slack size={20} color="#4a154b" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: typography.bodySm.size,
            fontWeight: 700,
            color: colors["text-primary"],
          }}
        >
          {workspace.teamName}
        </div>
        {workspace.teamDomain != null && (
          <div style={{ fontSize: "12px", color: colors["text-tertiary"] }}>
            {workspace.teamDomain}.slack.com
          </div>
        )}
        {connectedLabel != null && (
          <div style={{ fontSize: "11px", color: colors["text-tertiary"], marginTop: 2 }}>
            Connected {connectedLabel}
          </div>
        )}
        <span
          style={{
            display: "inline-block",
            marginTop: spacing[2],
            fontSize: typography.captionSm.size,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: borderRadius.full,
            backgroundColor: colors["success-bg"],
            color: colors["success-dark"],
          }}
        >
          {workspace.channelCount} channel{workspace.channelCount === 1 ? "" : "s"}{" "}
          monitored
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDisconnect();
        }}
        style={{
          flexShrink: 0,
          padding: `${spacing[1]} ${spacing[3]}`,
          borderRadius: borderRadius.md,
          border: `1px solid ${colors.danger}`,
          backgroundColor: "transparent",
          color: colors.danger,
          fontSize: typography.captionSm.size,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Disconnect
      </button>
    </div>
  );
}

// ── Channel list with toggles ────────────────────────────────────────────────

function ChannelList({
  channels,
  clients,
  savingChannelId,
  onToggle,
  onClientSelect,
}: {
  channels: SlackChannelItem[];
  clients: SlackClientOption[];
  savingChannelId: string | null;
  onToggle: (ch: SlackChannelItem, enabled: boolean) => void;
  onClientSelect: (ch: SlackChannelItem, clientId: string) => void;
}) {
  if (channels.length === 0) {
    return (
      <p style={{ fontSize: typography.bodySm.size, color: colors["text-tertiary"] }}>
        No channels found in this workspace.
      </p>
    );
  }

  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        border: `1px solid ${colors["border-default"]}`,
        borderRadius: borderRadius.md,
        overflow: "hidden",
      }}
    >
      {channels.map((ch) => (
        <ChannelRow
          key={ch.id}
          channel={ch}
          clients={clients}
          isSaving={savingChannelId === ch.id}
          onToggle={(enabled) => onToggle(ch, enabled)}
          onClientSelect={(clientId) => onClientSelect(ch, clientId)}
        />
      ))}
    </ul>
  );
}

function ChannelRow({
  channel,
  clients,
  isSaving,
  onToggle,
  onClientSelect,
}: {
  channel: SlackChannelItem;
  clients: SlackClientOption[];
  isSaving: boolean;
  onToggle: (enabled: boolean) => void;
  onClientSelect: (clientId: string) => void;
}) {
  const enabled = channel.isClientChannel;
  const displayChannel = channel.displayName.startsWith("#")
    ? channel.displayName
    : `#${channel.channelName}`;

  return (
    <li
      style={{
        minHeight: "52px",
        borderBottom: `1px solid ${colors["border-default"]}`,
        padding: `${spacing[2]} ${spacing[3]}`,
        backgroundColor: colors["surface-card"],
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors["surface-subtle"];
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors["surface-card"];
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          minHeight: "36px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            {displayChannel}
          </div>
          <div style={{ fontSize: "11px", color: colors["text-tertiary"] }}>
            {channel.memberCount ?? 0} members
            {isSaving ? " · Saving…" : ""}
          </div>
        </div>

        <ToggleSwitch
          checked={enabled}
          disabled={isSaving}
          onChange={(checked) => onToggle(checked)}
          ariaLabel={`Monitor ${displayChannel}`}
        />
      </div>

      {enabled && (
        <div style={{ marginTop: spacing[2], paddingLeft: spacing[1] }}>
          <label
            style={{
              display: "block",
              fontSize: typography.captionSm.size,
              color: colors["text-secondary"],
              marginBottom: spacing[1],
            }}
          >
            Map to client
          </label>
          <select
            value={channel.clientId ?? ""}
            disabled={isSaving}
            onChange={(e) => onClientSelect(e.target.value)}
            style={{
              width: "100%",
              height: "36px",
              fontSize: typography.bodySm.size,
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors["border-default"]}`,
              backgroundColor: colors["surface-card"],
            }}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: borderRadius.full,
        border: "none",
        padding: 2,
        flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        backgroundColor: checked ? colors["brand-blue"] : colors["border-light"],
        transition: "background-color 0.15s",
      }}
    >
      <span
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: borderRadius.full,
          backgroundColor: colors["surface-card"],
          transform: checked ? "translateX(20px)" : "translateX(0)",
          transition: "transform 0.15s",
        }}
      />
    </button>
  );
}

// ── Sub-section 3: horizontal workspace switcher ─────────────────────────────

function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onAddWorkspace,
  isConnecting,
}: {
  workspaces: SlackWorkspaceSummary[];
  activeWorkspaceId: string | null;
  onSelect: (id: string) => void;
  onAddWorkspace: () => void;
  isConnecting: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: spacing[3],
        overflowX: "auto",
        paddingBottom: spacing[2],
      }}
    >
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        return (
          <button
            key={ws.id}
            type="button"
            onClick={() => onSelect(ws.id)}
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: spacing[2],
              width: 100,
              padding: spacing[3],
              borderRadius: borderRadius.md,
              border: `2px solid ${isActive ? colors["brand-blue"] : colors["border-default"]}`,
              backgroundColor: isActive
                ? colors["surface-blue-tint"]
                : colors["surface-card"],
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: borderRadius.full,
                backgroundColor: colors["surface-subtle"],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {ws.teamIcon ? (
                <img src={ws.teamIcon} alt="" width={32} height={32} />
              ) : (
                <Slack size={16} color="#4a154b" />
              )}
            </div>
            <span
              style={{
                fontSize: typography.captionSm.size,
                fontWeight: 600,
                color: colors["text-primary"],
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {ws.teamName}
            </span>
            {isActive && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors["brand-blue"],
                }}
              />
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddWorkspace}
        disabled={isConnecting}
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[1],
          width: 100,
          minHeight: 88,
          padding: spacing[3],
          borderRadius: borderRadius.md,
          border: `1px dashed ${colors["border-light"]}`,
          backgroundColor: colors["surface-card"],
          color: colors["brand-blue"],
          fontSize: typography.captionSm.size,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Plus size={20} />
        Add Another Workspace
      </button>
    </div>
  );
}

const addWorkspaceBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: spacing[2],
  width: "100%",
  padding: spacing[3],
  borderRadius: borderRadius.md,
  border: `1px dashed ${colors["border-light"]}`,
  backgroundColor: colors["surface-card"],
  color: colors["brand-blue"],
  fontSize: typography.bodySm.size,
  fontWeight: 600,
  cursor: "pointer",
};

/** Persist channel mappings before finishing onboarding */
export async function savePendingSlackChannelMap(
  _selections: Record<string, { selected: boolean; clientId: string }>,
  _channels: SlackChannelItem[],
): Promise<void> {
  /* Mappings saved live via PATCH /api/slack/channels/:id */
}
