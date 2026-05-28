// meetings.api.ts — MeetingsPage list and detail tabs
import api from "./axios";

/** GET /meetings — left panel meeting cards */
export interface MeetingSummary {
  id: string;
  title: string;
  schedule: string;
  duration: string;
  statusLabel: string;
  statusKind?: string;
}

export async function getMeetings(): Promise<MeetingSummary[]> {
  const { data } = await api.get<MeetingSummary[]>("/meetings");
  return data;
}

/** GET /meetings/:id — header, summary, stories, commitments */
export async function getMeetingDetail<T = Record<string, unknown>>(
  id: string,
): Promise<T> {
  const { data } = await api.get<T>(`/meetings/${id}`);
  return data;
}

/** GET /meetings/:id/transcript — transcript tab lines */
export async function getMeetingTranscript(
  id: string,
): Promise<Record<string, unknown>[]> {
  const { data } = await api.get<Record<string, unknown>[]>(
    `/meetings/${id}/transcript`,
  );
  return data;
}
