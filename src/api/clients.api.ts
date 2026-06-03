// clients.api.ts — ClientsPage list and ClientDetailPage detail
import api from "./axios";

/** Row returned by GET /api/clients */
export interface ClientSummary {
  id: string;
  name: string;
  company: string;
  healthScore: number;
  status: string;
  contractValue: string | null;
  projectName: string | null;
  lastActivity: string | null;
}

/** Full detail returned by GET /api/clients/:id */
export interface ClientDetail {
  id: string;
  name: string;
  company: string;
  projectName: string;
  contractValue: string;
  healthScore: number;
  status: string;
  createdAt: string;
  scoreHistory: number[];
  storyCounts: {
    total: number;
    bugs: number;
    features: number;
    changes: number;
  };
  recentMessages: Array<{
    id: string;
    text: string;
    aiProcessed: boolean;
  }>;
  commitments: Array<{
    id: string;
    text: string;
    status: "open" | "done" | "overdue";
  }>;
  meetingCount: number;
}

/** GET /api/clients — list all clients for the organisation */
export async function getAllClients(): Promise<ClientSummary[]> {
  const { data } = await api.get<ClientSummary[]>("/clients");
  return data;
}

/** GET /api/clients/:id — full client detail */
export async function getClientById(id: string): Promise<ClientDetail> {
  const { data } = await api.get<{ success: boolean; client: ClientDetail }>(
    `/clients/${id}`,
  );
  return data.client;
}
