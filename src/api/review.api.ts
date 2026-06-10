// review.api.ts — ReviewQueuePage BA approval workflow
import api from "./axios";

export interface AcFormatted {
  id: string;
  scenario?: string;
  given?: string;
  when?: string;
  then?: string;
}

export interface ReviewStory {
  id: string;
  ticketId: string;
  storyTitle?: string;
  title: string;
  description?: string;
  type: string;
  priority: string;
  source: string;
  sourceQuote?: string;
  acceptanceCriteria: string[];
  acceptanceCriteriaFormatted?: AcFormatted[];
  releaseNotes?: string;
  client: string;
  clientId?: string;
  sprint?: string;
  status: string;
  timeAgo: string;
  regressionWarning?: string;
  goLiveWarning?: string;
  isAIGenerated?: boolean;
}

export interface ReviewQueueStats {
  pending: number;
  approvedToday: number;
  rejected: number;
  edited: number;
}

export interface ReviewWorkspaceInfo {
  id: string;
  teamName: string;
  displayName: string;
}

interface ReviewListResponse {
  success: boolean;
  stories: ReviewStory[];
  stats: ReviewQueueStats;
  workspace?: ReviewWorkspaceInfo | null;
}

/** GET /api/review — pending stories scoped by x-workspace-id header */
export async function fetchReviewQueue(): Promise<{
  stories: ReviewStory[];
  stats: ReviewQueueStats;
  workspace: ReviewWorkspaceInfo | null;
}> {
  const { data } = await api.get<ReviewListResponse>("/review");
  return {
    stories: data.stories ?? [],
    stats: data.stats ?? {
      pending: 0,
      approvedToday: 0,
      rejected: 0,
      edited: 0,
    },
    workspace: data.workspace ?? null,
  };
}

/** @deprecated use fetchReviewQueue */
export async function getPendingStories(): Promise<ReviewStory[]> {
  const { stories } = await fetchReviewQueue();
  return stories;
}

/** PATCH /api/stories/:id/approve */
export async function approveStory(id: string): Promise<void> {
  await api.patch(`/stories/${id}/approve`);
}

/** PATCH /api/stories/:id/reject */
export async function rejectStory(id: string): Promise<void> {
  await api.patch(`/stories/${id}/reject`);
}

/** PATCH /api/stories/:id — edit panel save */
export async function editStory(
  id: string,
  payload: {
    storyTitle?: string;
    title?: string;
    description?: string;
    type?: string;
    priority?: string;
    acceptanceCriteria?: string[];
    acceptanceCriteriaFormatted?: AcFormatted[];
    releaseNotes?: string;
    sprint?: string;
    assignee?: string;
  },
): Promise<ReviewStory> {
  const { data } = await api.patch<{ success: boolean; story: ReviewStory }>(
    `/stories/${id}`,
    payload,
  );
  return data.story;
}
