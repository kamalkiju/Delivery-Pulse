// slack.api.ts — SlackMessagesPage inbox and story actions
import api from "./axios";

export interface SlackWorkspaceInfo {
  connected: boolean;
  teamName: string | null;
  teamId: string | null;
  displayName: string | null;
  activeWorkspaceId?: string | null;
}

export interface SlackWorkspaceOption {
  id: string;
  teamId: string;
  teamName: string;
  teamIcon?: string | null;
}

/** List item from GET /api/slack/messages */
export interface SlackMessageListItem {
  id: string;
  messageText: string;
  senderName: string;
  channelName: string;
  workspaceName?: string;
  sourceLine?: string;
  createdAt: string;
  time: string;
  aiProcessed: boolean;
  storyId: string | null;
  hasImage: boolean;
  isExternal: boolean;
  autoReplySent: boolean;
  clientName: string;
  company: string;
  initials: string;
  avatarColor: string;
  statusVariant: string;
  statusLabel: string;
  senderType: "client" | "internal";
}

export interface SlackGeneratedStory {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  acceptanceCriteria: string[];
  sourceQuote: string;
  isAIGenerated: boolean;
}

export interface SlackAiAnalysis {
  type?: string;
  priority?: string;
  status?: string;
  title?: string;
  summary?: string;
}

/** Full detail from GET /api/slack/messages/:id */
export interface SlackMessageDetail extends SlackMessageListItem {
  imageUrl: string | null;
  threadTs?: string;
  channelId?: string;
  originalText: string;
  aiAnalysis: SlackAiAnalysis | null;
  generatedStory: SlackGeneratedStory | null;
}

/** GET /api/slack/messages — scoped by JWT org + x-workspace-id header */
export async function getSlackMessages(): Promise<{
  messages: SlackMessageListItem[];
  workspace: SlackWorkspaceInfo;
  workspaces: SlackWorkspaceOption[];
}> {
  const { data } = await api.get<{
    success: boolean;
    messages: SlackMessageListItem[];
    workspace: SlackWorkspaceInfo;
    workspaces?: SlackWorkspaceOption[];
  }>("/slack/messages");

  return {
    messages: data.messages ?? [],
    workspace: data.workspace ?? {
      connected: false,
      teamName: null,
      teamId: null,
      displayName: null,
    },
    workspaces: data.workspaces ?? [],
  };
}

/** GET /api/slack/messages/:id — right panel detail */
export async function getMessageDetail(id: string): Promise<SlackMessageDetail> {
  const { data } = await api.get<{
    success: boolean;
    message: SlackMessageDetail;
  }>(`/slack/messages/${id}`);
  return data.message;
}

/** POST /api/stories/:id/approve */
export async function approveStoryById(storyId: string): Promise<void> {
  await api.post(`/stories/${storyId}/approve`);
}

/** POST /api/stories/:id/reject */
export async function rejectStoryById(storyId: string): Promise<void> {
  await api.post(`/stories/${storyId}/reject`);
}
