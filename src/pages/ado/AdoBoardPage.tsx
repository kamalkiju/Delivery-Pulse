import { useState, useEffect } from "react";
import api from "../../api/axios";
import AppShell from "../../components/layout/AppShell";

interface WorkItem {
  adoId: string | number;
  title: string;
  state?: string;
  type?: string;
  priority?: string | number;
  assignedTo?: string;
  assignedToEmail?: string;
  iteration?: string;
  tags?: string;
  changedDate?: string;
  adoUrl?: string;
}

interface LocalStory {
  adoId?: string;
  storyTitle?: string;
  title?: string;
  adoStatus?: string;
  status?: string;
  type?: string;
  priority?: string;
  assigneeName?: string;
  assignee?: string;
  sprint?: string;
  tags?: string[];
  updatedAt?: string;
  adoUrl?: string;
}

interface SyncResult {
  synced?: number;
  total?: number;
  message?: string;
  error?: string;
}

interface BulkResult {
  pushed?: number;
  failed?: number;
  total?: number;
  message?: string;
  error?: string;
}

const ORG = "kamal02211994";
const PROJECT = "Delivery%20pulse";

export default function AdoBoardPage() {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [localStories, setLocalStories] = useState<LocalStory[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isBulkPushing, setIsBulkPushing] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [filterState, setFilterState] = useState("all");

  const fetchBoard = async () => {
    try {
      const response = await api.get("/ado/board");
      setLocalStories(response.data.stories || []);
    } catch (error) {
      console.error("Failed to fetch board:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadBoard = async () => {
      await fetchBoard();
      setIsSyncing(true);
      setSyncResult(null);
      try {
        const response = await api.get("/ado/sync");
        const { synced, total, workItems: items, message } = response.data;
        setWorkItems(items || []);
        setSyncResult({ synced, total, message });
        setLastSynced(new Date());
        await fetchBoard();
        console.log("[sync] Synced", synced, "of", total, "items");
      } catch (error: unknown) {
        console.error("Sync failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        setSyncResult({ error: `Sync failed: ${msg}` });
      } finally {
        setIsSyncing(false);
      }
    };

    loadBoard();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await api.get("/ado/sync");
      const { synced, total, workItems: items, message } = response.data;
      setWorkItems(items || []);
      setSyncResult({ synced, total, message });
      setLastSynced(new Date());
      await fetchBoard();
      console.log("[sync] Synced", synced, "of", total, "items");
    } catch (error: unknown) {
      console.error("Sync failed:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      setSyncResult({ error: `Sync failed: ${msg}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkPush = async () => {
    if (!window.confirm(
      "Push all approved stories without ADO ID to Azure DevOps?\n\nThis may take a few minutes.",
    )) {
      return;
    }

    setIsBulkPushing(true);
    setBulkResult(null);

    try {
      const response = await api.post("/ado/bulk-push");
      const { pushed, failed, total, message } = response.data;

      setBulkResult({ pushed, failed, total, message });
      console.log("[bulk-push] Result:", response.data);

      await handleSync();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setBulkResult({ error: `Bulk push failed: ${msg}` });
    } finally {
      setIsBulkPushing(false);
    }
  };

  const stateColors: Record<string, { bg: string; text: string; border: string }> = {
    "To Do": {
      bg: "#f1f5f9",
      text: "#64748b",
      border: "#cbd5e1",
    },
    Doing: {
      bg: "#eff6ff",
      text: "#2563eb",
      border: "#93c5fd",
    },
    Done: {
      bg: "#f0fdf4",
      text: "#16a34a",
      border: "#86efac",
    },
    Active: {
      bg: "#eff6ff",
      text: "#2563eb",
      border: "#93c5fd",
    },
    Resolved: {
      bg: "#f0fdf4",
      text: "#16a34a",
      border: "#86efac",
    },
    Closed: {
      bg: "#f8fafc",
      text: "#94a3b8",
      border: "#e2e8f0",
    },
    New: {
      bg: "#f1f5f9",
      text: "#64748b",
      border: "#cbd5e1",
    },
    "pushed-to-ado": {
      bg: "#fff7ed",
      text: "#c2410c",
      border: "#fed7aa",
    },
    "in-progress": {
      bg: "#eff6ff",
      text: "#2563eb",
      border: "#93c5fd",
    },
    done: {
      bg: "#f0fdf4",
      text: "#16a34a",
      border: "#86efac",
    },
    approved: {
      bg: "#faf5ff",
      text: "#7c3aed",
      border: "#d8b4fe",
    },
  };

  const priorityColors: Record<string | number, { label: string; color: string }> = {
    1: { label: "Critical", color: "#dc2626" },
    2: { label: "High", color: "#ea580c" },
    3: { label: "Medium", color: "#d97706" },
    4: { label: "Low", color: "#16a34a" },
    Critical: { label: "Critical", color: "#dc2626" },
    High: { label: "High", color: "#ea580c" },
    Medium: { label: "Medium", color: "#d97706" },
    Low: { label: "Low", color: "#16a34a" },
  };

  const displayItems: WorkItem[] = workItems.length > 0
    ? workItems
    : localStories.map((s) => ({
        adoId: s.adoId ?? "",
        title: s.storyTitle || s.title || "Untitled",
        state: s.adoStatus || "To Do",
        type: s.type,
        priority: s.priority,
        assignedTo: s.assigneeName || s.assignee,
        assignedToEmail: s.assignee,
        iteration: s.sprint,
        tags: s.tags?.join("; "),
        changedDate: s.updatedAt,
        adoUrl: s.adoUrl || `https://dev.azure.com/${ORG}/${PROJECT}/_workitems/edit/${s.adoId}`,
      }));

  const filteredItems = filterState === "all"
    ? displayItems
    : displayItems.filter((item) => {
        const state = (item.state || "").toLowerCase();
        if (filterState === "todo") {
          return state === "to do"
            || state === "new"
            || state === "pushed-to-ado";
        }
        if (filterState === "doing") {
          return state === "doing"
            || state === "active"
            || state === "in-progress";
        }
        if (filterState === "done") {
          return state === "done"
            || state === "closed"
            || state === "resolved";
        }
        return state === filterState;
      });

  const stateCounts = {
    all: displayItems.length,
    todo: displayItems.filter((i) =>
      i.state === "To Do"
      || i.state === "New"
      || i.state === "pushed-to-ado",
    ).length,
    doing: displayItems.filter((i) =>
      i.state === "Doing"
      || i.state === "Active"
      || i.state === "in-progress",
    ).length,
    done: displayItems.filter((i) =>
      i.state === "Done"
      || i.state === "Closed"
      || i.state === "Resolved"
      || i.state === "done",
    ).length,
  };

  return (
    <AppShell pageTitle="ADO Board">
      <div style={{
        height: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f1f5f9",
        margin: "-24px",
      }}>
        <div style={{
          backgroundColor: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 24px",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                ADO Board
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                Azure DevOps work items synced from DeliveryPulse
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {lastSynced && (
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Last synced: {lastSynced.toLocaleTimeString()}
                </span>
              )}

              <a
                href={`https://dev.azure.com/${ORG}/${PROJECT}/_boards/board/t/Delivery%20pulse%20Team/Issues`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  backgroundColor: "#0078d4",
                  color: "white",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Open in ADO ↗
              </a>

              <button
                type="button"
                onClick={handleBulkPush}
                disabled={isBulkPushing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 20px",
                  backgroundColor: isBulkPushing ? "#94a3b8" : "#7c3aed",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isBulkPushing ? "not-allowed" : "pointer",
                }}
              >
                {isBulkPushing ? "⏳ Pushing..." : "⬆️ Push Missing to ADO"}
              </button>

              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 20px",
                  backgroundColor: isSyncing ? "#94a3b8" : "#1c2655",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSyncing ? "not-allowed" : "pointer",
                }}
              >
                {isSyncing ? "⟳ Syncing..." : "⟳ Sync ADO"}
              </button>
            </div>
          </div>

          {syncResult && (
            <div style={{
              marginTop: 12,
              padding: "10px 14px",
              backgroundColor: syncResult.error ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${syncResult.error ? "#fca5a5" : "#86efac"}`,
              borderRadius: 8,
              fontSize: 13,
              color: syncResult.error ? "#dc2626" : "#16a34a",
            }}>
              {syncResult.error
                ? `❌ ${syncResult.error}`
                : `✅ Synced ${syncResult.synced} updated stories from ${syncResult.total} total ADO work items`}
            </div>
          )}

          {bulkResult && (
            <div style={{
              marginTop: 8,
              padding: "10px 14px",
              backgroundColor: bulkResult.error ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${bulkResult.error ? "#fca5a5" : "#86efac"}`,
              borderRadius: 8,
              fontSize: 13,
              color: bulkResult.error ? "#dc2626" : "#16a34a",
            }}>
              {bulkResult.error
                ? `❌ ${bulkResult.error}`
                : `✅ ${bulkResult.message}`}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All", count: stateCounts.all, color: "#64748b" },
              { key: "todo", label: "To Do", count: stateCounts.todo, color: "#64748b" },
              { key: "doing", label: "Doing", count: stateCounts.doing, color: "#2563eb" },
              { key: "done", label: "Done", count: stateCounts.done, color: "#16a34a" },
            ].map((stat) => (
              <button
                key={stat.key}
                type="button"
                onClick={() => setFilterState(stat.key)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  backgroundColor: filterState === stat.key ? stat.color + "15" : "transparent",
                  borderBottom: filterState === stat.key ? `2px solid ${stat.color}` : "2px solid transparent",
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontWeight: filterState === stat.key ? 600 : 400,
                  color: filterState === stat.key ? stat.color : "#94a3b8",
                }}>
                  {stat.label} ({stat.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
              Loading ADO board...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
              <p style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
                No ADO work items yet
              </p>
              <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
                Approve stories in Review Queue to push them to ADO
              </p>
              <button
                type="button"
                onClick={handleSync}
                style={{
                  backgroundColor: "#1c2655",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                ⟳ Sync from ADO
              </button>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
              gap: 16,
            }}>
              {filteredItems.map((item, index) => {
                const adoState = item.state || "To Do";
                const stateColor = stateColors[adoState] || stateColors["To Do"];
                const priorityInfo = item.priority != null
                  ? priorityColors[item.priority]
                  : undefined;

                return (
                  <div
                    key={String(item.adoId || index)}
                    style={{
                      backgroundColor: "white",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      padding: "16px 20px",
                      borderLeft: `4px solid ${stateColor.border}`,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {item.adoId && (
                        <span style={{
                          backgroundColor: "#eff6ff",
                          color: "#2563eb",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          ADO #{item.adoId}
                        </span>
                      )}
                      <span style={{
                        backgroundColor: stateColor.bg,
                        color: stateColor.text,
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                      }}>
                        {adoState}
                      </span>
                      {priorityInfo && (
                        <span style={{
                          backgroundColor: priorityInfo.color + "20",
                          color: priorityInfo.color,
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {priorityInfo.label}
                        </span>
                      )}
                      {item.type && (
                        <span style={{
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                        }}>
                          {item.type}
                        </span>
                      )}
                    </div>

                    <h3 style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: "0 0 12px",
                      lineHeight: 1.4,
                    }}>
                      {item.title}
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                      {item.assignedTo && (
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          👤 <strong>Assigned:</strong> {item.assignedTo}
                        </div>
                      )}
                      {item.iteration && (
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          📅 <strong>Sprint:</strong> {item.iteration.split("\\").pop()}
                        </div>
                      )}
                      {item.tags && (
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          🏷️ {item.tags.split(";").map((tag, i) => (
                            <span key={i} style={{
                              backgroundColor: "#f1f5f9",
                              padding: "1px 6px",
                              borderRadius: 4,
                              marginLeft: 4,
                              fontSize: 11,
                            }}>
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.changedDate && (
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          🕐 Updated: {new Date(item.changedDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {item.adoUrl && (
                      <a
                        href={item.adoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          backgroundColor: "#0078d4",
                          color: "white",
                          padding: "6px 14px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        View in ADO ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
