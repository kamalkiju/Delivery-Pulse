// slack.integration.api.ts — Multi-workspace Slack OAuth + channel setup
import api from "./axios";

export interface SlackConnectionStatus {
  connected: boolean;
  teamName: string | null;
  teamId: string | null;
  teamIcon?: string | null;
  connectedAt?: string;
  activeWorkspaceId?: string | null;
  workspaces?: Array<{
    id: string;
    teamName: string;
    teamIcon?: string | null;
  }>;
  monitoredChannelCount: number;
  botActive: boolean;
}

export interface SlackWorkspaceSummary {
  id: string;
  teamId: string;
  teamName: string;
  teamDomain?: string | null;
  teamIcon?: string | null;
  connectedAt: string;
  channelCount: number;
}

export interface SlackChannelItem {
  id: string;
  channelId: string;
  channelName: string;
  memberCount?: number;
  displayName: string;
  isPrivate: boolean;
  isClientChannel: boolean;
  clientId: string | null;
  clientName: string | null;
}

export interface SlackClientOption {
  id: string;
  name: string;
  company: string;
}

export async function getSlackStatus(): Promise<SlackConnectionStatus> {
  const { data } = await api.get<SlackConnectionStatus & { success: boolean }>(
    "/slack/status",
  );
  return {
    connected: data.connected,
    teamName: data.teamName,
    teamId: data.teamId,
    teamIcon: data.teamIcon ?? null,
    connectedAt: data.connectedAt,
    activeWorkspaceId: data.activeWorkspaceId ?? null,
    workspaces: data.workspaces ?? [],
    monitoredChannelCount: data.monitoredChannelCount ?? 0,
    botActive: data.botActive ?? false,
  };
}

export async function getSlackWorkspaces(): Promise<SlackWorkspaceSummary[]> {
  const { data } = await api.get<{
    success: boolean;
    workspaces: SlackWorkspaceSummary[];
  }>("/slack/workspaces");
  return data.workspaces ?? [];
}

export async function getWorkspaceChannels(
  workspaceId: string,
): Promise<{
  workspace: { id: string; teamName: string; teamIcon?: string | null };
  channels: SlackChannelItem[];
  clients: SlackClientOption[];
}> {
  const { data } = await api.get<{
    success: boolean;
    workspace: { id: string; teamName: string; teamIcon?: string | null };
    channels: SlackChannelItem[];
    clients: SlackClientOption[];
  }>(`/slack/workspaces/${workspaceId}/channels`);

  return {
    workspace: data.workspace,
    channels: data.channels ?? [],
    clients: data.clients ?? [],
  };
}

export async function updateSlackChannel(
  channelMongoId: string,
  payload: { isClientChannel: boolean; clientId?: string | null },
): Promise<void> {
  await api.patch(`/slack/channels/${channelMongoId}`, payload);
}

export async function disconnectSlackWorkspace(workspaceId: string): Promise<void> {
  await api.delete(`/slack/workspaces/${workspaceId}`);
}

export async function disconnectSlack(): Promise<void> {
  await api.delete("/slack/disconnect");
}

/** GET /api/slack/channels?workspaceId= — onboarding shortcut */
export async function getSlackChannels(workspaceId?: string): Promise<{
  channels: SlackChannelItem[];
  clients: SlackClientOption[];
  workspace?: { id: string; teamName: string };
}> {
  const { data } = await api.get<{
    success: boolean;
    channels: SlackChannelItem[];
    clients: SlackClientOption[];
    workspace?: { id: string; teamName: string };
  }>("/slack/channels", {
    params: workspaceId ? { workspaceId } : undefined,
  });

  return {
    channels: data.channels ?? [],
    clients: data.clients ?? [],
    workspace: data.workspace,
  };
}

export async function switchSlackWorkspace(workspaceId: string): Promise<void> {
  await api.post(`/slack/workspaces/${workspaceId}/switch`);
}

export async function mapSlackChannels(
  mappings: Array<{ id?: string; channelId: string; clientId: string }>,
): Promise<{ monitoredChannelCount: number }> {
  const { data } = await api.post<{
    success: boolean;
    monitoredChannelCount: number;
  }>("/slack/channels/map", { mappings });

  return { monitoredChannelCount: data.monitoredChannelCount ?? 0 };
}

/**
 * getSlackConnectInit — two-step OAuth connect (preferred).
 *
 * Calls GET /api/slack/connect-init (authenticated via axios interceptor).
 * Backend generates a short-lived init token and returns the full connect URL.
 * The caller should then do `window.location.href = connectUrl` to start the OAuth flow.
 *
 * This avoids putting the JWT in the browser address bar / server logs.
 */
export async function getSlackConnectInit(
  returnTo: "settings" | "onboarding" = "settings",
): Promise<string> {
  const { data } = await api.get<{ success: boolean; connectUrl: string }>(
    "/slack/connect-init",
    { params: { returnTo } },
  );
  return data.connectUrl;
}

