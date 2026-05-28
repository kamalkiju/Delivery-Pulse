// dashboard.api.ts — DashboardPage KPIs, client table, AI activity, sprint health
import api from "./axios";

/** GET /dashboard/stats — KPI row */
export interface DashboardStats {
  activeClients: number;
  storiesThisWeek: number;
  aiStoriesThisWeek: number;
  avgHealthScore: number;
  slaAtRisk: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>("/dashboard/stats");
  return data;
}

/** GET /dashboard/clients — client health table */
export interface DashboardClient {
  id: string;
  name: string;
  score: number;
  status: string;
  lastActivity?: string;
}

export async function getClientHealth(): Promise<DashboardClient[]> {
  const { data } = await api.get<DashboardClient[]>("/dashboard/clients");
  return data;
}

/** GET /dashboard/activity — AI activity from slackmessages */
export interface AIActivityItem {
  id: string;
  type: string;
  description: string;
  time: string;
  isExternal?: boolean;
  aiProcessed?: boolean;
}

export async function getAIActivity(): Promise<AIActivityItem[]> {
  const { data } = await api.get<AIActivityItem[]>("/dashboard/activity");
  return data;
}

/** GET /dashboard/sprint-health — story counts per sprint */
export interface SprintHealthItem {
  name: string;
  total: number;
  done: number;
  inReview: number;
  inProgress: number;
  atRisk: number;
  progressPercent: number;
  health: "healthy" | "at-risk" | "critical" | string;
}

export async function getSprintHealth(): Promise<SprintHealthItem[]> {
  const { data } = await api.get<SprintHealthItem[]>("/dashboard/sprint-health");
  return data;
}

/** GET /dashboard/commitments — verbal commitments */
export interface VerbalCommitmentItem {
  id: string;
  text: string;
  client: string;
}

export async function getVerbalCommitments(): Promise<VerbalCommitmentItem[]> {
  const { data } = await api.get<VerbalCommitmentItem[]>("/dashboard/commitments");
  return data;
}
