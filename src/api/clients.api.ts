// clients.api.ts — ClientDetailPage and client list
import api from "./axios";

/** GET /clients — all clients (future clients list page) */
export interface ClientSummary {
  id: string;
  name: string;
  healthScore?: number;
  status?: string;
}

export async function getAllClients(): Promise<ClientSummary[]> {
  const { data } = await api.get<ClientSummary[]>("/clients");
  return data;
}

/** GET /clients/:id — full client profile for ClientDetailPage */
export async function getClientById<T = Record<string, unknown>>(
  id: string,
): Promise<T> {
  const { data } = await api.get<T>(`/clients/${id}`);
  return data;
}

/** GET /clients/:id/health — health score history and breakdown */
export async function getClientHealthById<T = Record<string, unknown>>(
  id: string,
): Promise<T> {
  const { data } = await api.get<T>(`/clients/${id}/health`);
  return data;
}
