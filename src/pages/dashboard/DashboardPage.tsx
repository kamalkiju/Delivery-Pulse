import { useState, useEffect } from "react";
import api from "../../api/axios";
import AppShell from "../../components/layout/AppShell";

interface DashboardStats {
  totalStories: number;
  pendingReview: number;
  approved: number;
  pushedToADO: number;
  totalMessages: number;
  todayStories: number;
  todayMessages: number;
  aiGeneratedStories: number;
  slackStories: number;
  documentStories: number;
  connectedWorkspaces: number;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  client: string;
  timeAgo: string;
  adoId?: string;
}

interface ClientItem {
  _id: string;
  name: string;
  company?: string;
  totalStories: number;
  totalMessages: number;
  adoStories: number;
  healthScore: number;
  status?: string;
}

interface SprintHealth {
  currentSprint: {
    total: number;
    done: number;
    inProgress: number;
    toDo: number;
    velocity: number;
  };
  nextSprint: {
    total: number;
    planned: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [sprintHealth, setSprintHealth] = useState<SprintHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = async () => {
    try {
      const [statsRes, activityRes, clientsRes, sprintRes] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/dashboard/activity"),
        api.get("/dashboard/clients"),
        api.get("/dashboard/sprint-health"),
      ]);

      setStats(statsRes.data.stats);
      setActivity(activityRes.data.activity || []);
      setClients(clientsRes.data.clients || []);
      setSprintHealth(sprintRes.data.sprintHealth);
      setLastUpdated(new Date());

      console.log("[dashboard] stats:", statsRes.data.stats);
      console.log("[dashboard] clients:", clientsRes.data.clients?.length);
      console.log("[dashboard] activity:", activityRes.data.activity?.length);
    } catch (error) {
      console.error("[dashboard] fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <AppShell pageTitle="Dashboard">
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "calc(100vh - 60px)",
          color: "#64748b",
          fontSize: 16,
        }}>
          Loading dashboard...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Dashboard">
      <div style={{
        padding: 24,
        backgroundColor: "#f1f5f9",
        minHeight: "calc(100vh - 60px)",
        margin: -24,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Dashboard
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
              AI-Powered Delivery Intelligence
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {lastUpdated && (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                🕐 Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={fetchDashboard}
              style={{
                padding: "8px 16px",
                backgroundColor: "#1c2655",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              ⟳ Refresh
            </button>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}>
          {[
            {
              label: "Total Stories",
              value: stats?.totalStories || 0,
              sub: `${stats?.todayStories || 0} created today`,
              icon: "📋",
              color: "#0088ff",
              bg: "#eff6ff",
            },
            {
              label: "Slack Messages",
              value: stats?.totalMessages || 0,
              sub: `${stats?.slackStories || 0} stories from Slack`,
              icon: "💬",
              color: "#7c3aed",
              bg: "#faf5ff",
            },
            {
              label: "Pushed to ADO",
              value: stats?.pushedToADO || 0,
              sub: `${stats?.approved || 0} approved total`,
              icon: "✅",
              color: "#16a34a",
              bg: "#f0fdf4",
            },
            {
              label: "Pending Review",
              value: stats?.pendingReview || 0,
              sub: `${stats?.documentStories || 0} from documents`,
              icon: "⏳",
              color: "#f59e0b",
              bg: "#fffbeb",
            },
          ].map((card, i) => (
            <div key={i} style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: "20px 24px",
              border: "1px solid #e2e8f0",
              borderTop: `3px solid ${card.color}`,
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}>
                <div>
                  <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px", fontWeight: 500 }}>
                    {card.label}
                  </p>
                  <p style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#0f172a",
                    margin: "0 0 4px",
                    lineHeight: 1,
                  }}>
                    {card.value}
                  </p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                    {card.sub}
                  </p>
                </div>
                <div style={{
                  backgroundColor: card.bg,
                  borderRadius: 10,
                  padding: "10px",
                  fontSize: 22,
                }}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            border: "1px solid #e2e8f0",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              🏃 Sprint Health
            </h2>

            {sprintHealth ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                      Current Sprint
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0088ff" }}>
                      {sprintHealth.currentSprint?.velocity || 0}% complete
                    </span>
                  </div>
                  <div style={{
                    height: 8,
                    backgroundColor: "#f1f5f9",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: 8,
                      backgroundColor: "#0088ff",
                      borderRadius: 999,
                      width: `${sprintHealth.currentSprint?.velocity || 0}%`,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}>
                  {[
                    {
                      label: "To Do",
                      value: sprintHealth.currentSprint?.toDo || 0,
                      color: "#64748b",
                      bg: "#f1f5f9",
                    },
                    {
                      label: "In Progress",
                      value: sprintHealth.currentSprint?.inProgress || 0,
                      color: "#2563eb",
                      bg: "#eff6ff",
                    },
                    {
                      label: "Done",
                      value: sprintHealth.currentSprint?.done || 0,
                      color: "#16a34a",
                      bg: "#f0fdf4",
                    },
                  ].map((item, i) => (
                    <div key={i} style={{
                      backgroundColor: item.bg,
                      borderRadius: 8,
                      padding: "12px",
                      textAlign: "center",
                    }}>
                      <p style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: item.color,
                        margin: "0 0 4px",
                      }}>
                        {item.value}
                      </p>
                      <p style={{
                        fontSize: 11,
                        color: item.color,
                        margin: 0,
                        fontWeight: 500,
                      }}>
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                {(sprintHealth.nextSprint?.total ?? 0) > 0 && (
                  <div style={{
                    marginTop: 16,
                    padding: "10px 14px",
                    backgroundColor: "#faf5ff",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#7c3aed",
                  }}>
                    📅 Next Sprint: {sprintHealth.nextSprint.total} stories planned
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>
                No sprint data yet
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            border: "1px solid #e2e8f0",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              🤖 AI Performance
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  label: "AI Generated Stories",
                  value: stats?.aiGeneratedStories || 0,
                  total: stats?.totalStories || 0,
                  color: "#0088ff",
                },
                {
                  label: "Stories Pushed to ADO",
                  value: stats?.pushedToADO || 0,
                  total: stats?.totalStories || 0,
                  color: "#16a34a",
                },
                {
                  label: "Connected Workspaces",
                  value: stats?.connectedWorkspaces || 0,
                  total: null as number | null,
                  color: "#7c3aed",
                },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>
                      {item.total !== null
                        ? `${item.value} / ${item.total}`
                        : item.value}
                    </span>
                  </div>
                  {item.total !== null && item.total > 0 && (
                    <div style={{
                      height: 6,
                      backgroundColor: "#f1f5f9",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: 6,
                        backgroundColor: item.color,
                        borderRadius: 999,
                        width: `${Math.round((item.value / item.total) * 100)}%`,
                      }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            border: "1px solid #e2e8f0",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              👥 Client Health
            </h2>

            {clients.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>
                No clients found
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {clients.map((client) => {
                  const healthColor = client.healthScore >= 80 ? "#16a34a"
                    : client.healthScore >= 60 ? "#f59e0b"
                      : "#dc2626";

                  return (
                    <div key={client._id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      backgroundColor: "#f8fafc",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#0f172a",
                          margin: "0 0 2px",
                        }}>
                          {client.name}
                        </p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                          {client.totalStories} stories •
                          {" "}{client.totalMessages} messages •
                          {" "}{client.adoStories} in ADO
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <p style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: healthColor,
                            margin: 0,
                            lineHeight: 1,
                          }}>
                            {client.healthScore}
                          </p>
                          <p style={{
                            fontSize: 10,
                            color: healthColor,
                            margin: 0,
                            fontWeight: 500,
                          }}>
                            {client.status?.toUpperCase()}
                          </p>
                        </div>
                        <div style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: healthColor,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            border: "1px solid #e2e8f0",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              ⚡ Recent Activity
            </h2>

            {activity.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>
                No recent activity
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activity.map((item) => (
                  <div key={item.id} style={{
                    display: "flex",
                    gap: 12,
                    padding: "10px 12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: item.type === "story_created" ? "#eff6ff" : "#faf5ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      flexShrink: 0,
                    }}>
                      {item.type === "story_created" ? "📋" : "💬"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#0f172a",
                        margin: "0 0 2px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                        {item.client} • {item.timeAgo}
                      </p>
                    </div>
                    {item.adoId && (
                      <span style={{
                        fontSize: 11,
                        color: "#2563eb",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        ADO #{item.adoId}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
