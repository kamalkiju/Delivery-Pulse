// reports.api.ts — ReportsPage stats, table, and export
import api from "./axios";

/** GET /reports/stats?dateRange= — KPI + chart data */
export interface ReportStats {
  dateRange: string;
  kpis?: Record<string, unknown>;
  charts?: Record<string, unknown>;
}

export async function getReportStats(
  dateRange: string,
): Promise<ReportStats> {
  const { data } = await api.get<ReportStats>("/reports/stats", {
    params: { dateRange },
  });
  return data;
}

/** GET /reports/clients — client performance table rows */
export interface ClientPerformanceRow {
  client: string;
  healthScore: number;
  stories: number;
  avgResponse: string;
  delivery: string;
  trend: string;
  status: string;
}

export async function getClientPerformance(): Promise<ClientPerformanceRow[]> {
  const { data } = await api.get<ClientPerformanceRow[]>("/reports/clients");
  return data;
}

/** GET /reports/export?format=pdf|excel — triggers file download */
export async function exportReport(
  format: "pdf" | "excel",
): Promise<Blob> {
  const { data } = await api.get<Blob>("/reports/export", {
    params: { format },
    responseType: "blob",
  });
  return data;
}
