// ─────────────────────────────────────────────
// DashboardPage — main home screen after login
// Wrapped in AppShell (sidebar + topnav). Figma: Delivery Pulse Dashboard
// ─────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useWorkspaceChange } from "../../hooks/useWorkspaceChange";
import {
  getAIActivity,
  getClientHealth,
  getDashboardStats,
  getSprintHealth,
  getVerbalCommitments,
  type SprintHealthItem,
} from "../../api/dashboard.api";
import AppShell from "../../components/layout/AppShell";
import StatCard from "../../components/ui/StatCard";
import StatusBadge, { type BadgeVariant } from "../../components/ui/StatusBadge";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

/** Shape of one client row returned from GET /api/dashboard */
interface Client {
  id: string;
  name: string;
  healthScore: number;
  status: BadgeVariant;
}

/** One line in the AI activity feed (right panel) */
interface ActivityItem {
  id: string;
  text: string;
  time: string;
  dotColor: string;
}

/** Verbal commitment pulled from meetings / Slack */
interface VerbalCommitment {
  id: string;
  text: string;
  client: string;
}

// ── Helpers ──────────────────────────────────────────────────

/** Maps numeric health score to green / amber / red for the score column */
function getScoreColor(score: number): string {
  if (score >= 80) return colors.success; // #10b981
  if (score >= 60) return colors.warning; // #f59e0b
  return colors.danger; // #dc2626
}

function activityDotColor(type: string, isExternal?: boolean): string {
  if (type === "story") return colors["brand-blue"];
  if (type === "screenshot") return colors.warning;
  if (isExternal) return colors.danger;
  return colors.success;
}

function sprintHealthColor(health: string): string {
  if (health === "critical") return colors.danger;
  if (health === "at-risk") return colors.warning;
  return colors.success;
}

// ── Sub-components ───────────────────────────────────────────

/** Gray pulsing block used while isLoading is true */
function Skeleton({ height }: { height: string }) {
  return (
    <div
      className="dashboard-skeleton"
      style={{
        height,
        borderRadius: borderRadius.xs,
        backgroundColor: colors["border-default"],
      }}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────

const DashboardPage = () => {
  // clients — list for the health table; empty until fetch completes
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [commitments, setCommitments] = useState<VerbalCommitment[]>([]);
  const [sprintHealth, setSprintHealth] = useState<SprintHealthItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeClients: 0,
    storiesThisWeek: 0,
    aiStoriesThisWeek: 0,
    avgHealthScore: 0,
    slaAtRisk: 0,
  });

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, clientsRes, activityRes, sprintRes, commitmentsRes] =
        await Promise.all([
          getDashboardStats(),
          getClientHealth(),
          getAIActivity(),
          getSprintHealth(),
          getVerbalCommitments(),
        ]);

      setStats(statsRes);
      setClients(
        clientsRes.map((c) => ({
          id: c.id,
          name: c.name,
          healthScore: c.score,
          status: (c.status as BadgeVariant) || "healthy",
        })),
      );
      setActivities(
        activityRes.map((a) => ({
          id: a.id,
          text: a.description,
          time: a.time,
          dotColor: activityDotColor(a.type, a.isExternal),
        })),
      );
      setSprintHealth(sprintRes);
      setCommitments(commitmentsRes);
    } catch {
      setError("Could not load dashboard data. Check that you are logged in.");
      setClients([]);
      setActivities([]);
      setSprintHealth([]);
      setCommitments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useWorkspaceChange(loadDashboard);

  return (
    <AppShell pageTitle="Dashboard" showWorkspaceContext>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[5],
        }}
      >
        {/* ── ROW 1: four KPI StatCards ─────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: spacing[4],
          }}
        >
          <StatCard
            label="Active clients"
            value={stats.activeClients}
            trend="2 at risk"
            trendColor="#dc2626"
          />
          <StatCard
            label="Stories this week"
            value={stats.storiesThisWeek}
            trend={`${stats.aiStoriesThisWeek} auto-created by AI`}
            trendColor="#7c3aed"
          />
          <StatCard
            label="Avg health score"
            value={stats.avgHealthScore}
            trend={`${stats.activeClients} active clients`}
            trendColor="#16a34a"
          />
          <StatCard
            label="SLA at risk"
            value={stats.slaAtRisk}
            trend="Action needed today"
            trendColor="#dc2626"
            borderLeftColor="#dc2626"
          />
        </div>

        {error != null && (
          <p
            style={{
              margin: 0,
              color: colors.danger,
              fontSize: typography.bodySm.size,
            }}
          >
            {error}
          </p>
        )}

        {/* ── ROW 2: Sprint health (from stories collection) ── */}
        <div
          style={{
            backgroundColor: colors["surface-card"],
            borderRadius: borderRadius.md,
            border: `1px solid ${colors["border-default"]}`,
            padding: spacing[5],
          }}
        >
          <h2
            style={{
              margin: `0 0 ${spacing[4]} 0`,
              fontSize: typography.titleSm.size,
              fontWeight: typography.titleSm.weight,
              color: colors["text-primary"],
            }}
          >
            Sprint health
          </h2>
          {isLoading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: spacing[3],
              }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="88px" />
              ))}
            </div>
          ) : sprintHealth.length === 0 ? (
            <p style={{ margin: 0, color: colors["text-secondary"] }}>
              No sprint data yet — stories will appear here after Slack intake.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: spacing[3],
              }}
            >
              {sprintHealth.map((sprint) => (
                <div
                  key={sprint.name}
                  style={{
                    padding: spacing[4],
                    borderRadius: borderRadius.md,
                    border: `1px solid ${colors["border-default"]}`,
                    borderLeft: `4px solid ${sprintHealthColor(sprint.health)}`,
                    backgroundColor: colors["surface-subtle"],
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: spacing[2],
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: typography.bodySm.size,
                        color: colors["text-primary"],
                      }}
                    >
                      {sprint.name}
                    </span>
                    <StatusBadge
                      variant={
                        sprint.health === "critical"
                          ? "critical"
                          : sprint.health === "at-risk"
                            ? "at-risk"
                            : "healthy"
                      }
                    />
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: sprintHealthColor(sprint.health),
                      marginBottom: spacing[1],
                    }}
                  >
                    {sprint.progressPercent}%
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: typography.captionSm.size,
                      color: colors["text-secondary"],
                    }}
                  >
                    {sprint.done}/{sprint.total} done · {sprint.inReview} in
                    review · {sprint.atRisk} at risk
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ROW 3: client table + AI activity panel ───────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: spacing[4],
          }}
        >
          {/* Left: Client health overview table */}
          <div
            style={{
              backgroundColor: colors["surface-card"],
              borderRadius: borderRadius.md,
              border: `1px solid ${colors["border-default"]}`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: spacing[5],
                borderBottom: `1px solid ${colors["border-default"]}`,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: typography.titleSm.size,
                  fontWeight: typography.titleSm.weight,
                  color: colors["text-primary"],
                }}
              >
                Client health overview
              </h2>
            </div>

            {/* Table header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 100px",
                padding: "10px 20px",
                backgroundColor: colors["surface-subtle"],
                borderBottom: `1px solid ${colors["border-default"]}`,
              }}
            >
              {["CLIENT", "SCORE", "STATUS"].map((col) => (
                <span
                  key={col}
                  style={{
                    fontSize: typography.tableHeader.size,
                    fontWeight: typography.tableHeader.weight,
                    color: colors["text-secondary"],
                    textTransform: "uppercase",
                  }}
                >
                  {col}
                </span>
              ))}
            </div>

            {/* Table body — skeletons or client rows */}
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ padding: "14px 20px" }}
                  >
                    <Skeleton height="20px" />
                  </div>
                ))
              : clients.length === 0 ? (
                <div style={{ padding: spacing[5], color: colors["text-secondary"] }}>
                  No clients found for your organisation.
                </div>
              ) : (
              clients.map((client) => {
                  const isCritical = client.status === "critical";
                  return (
                    <div
                      key={client.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 100px",
                        alignItems: "center",
                        padding: "14px 20px",
                        borderBottom: `1px solid ${colors["border-default"]}`,
                        backgroundColor: isCritical
                          ? "rgba(220, 38, 38, 0.04)"
                          : colors["surface-card"],
                        borderLeft: isCritical
                          ? `3px solid ${colors.danger}`
                          : "none",
                      }}
                    >
                      <span
                        style={{
                          fontSize: typography.bodySm.size,
                          fontWeight: 500,
                          color: colors["text-primary"],
                        }}
                      >
                        {client.name}
                      </span>
                      <span
                        style={{
                          fontSize: "18px",
                          fontWeight: 800,
                          color: getScoreColor(client.healthScore),
                        }}
                      >
                        {client.healthScore}
                      </span>
                      <StatusBadge variant={client.status} />
                    </div>
                  );
                })
              )}
          </div>

          {/* Right: AI activity panel (380px column) */}
          <div
            style={{
              backgroundColor: colors["surface-card"],
              borderRadius: borderRadius.md,
              border: `1px solid ${colors["border-default"]}`,
              padding: spacing[5],
              display: "flex",
              flexDirection: "column",
              gap: spacing[4],
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: typography.titleSm.size,
                fontWeight: typography.titleSm.weight,
                color: colors["text-primary"],
              }}
            >
              AI activity
            </h2>

            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height="48px" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p style={{ margin: 0, color: colors["text-secondary"] }}>
                No Slack activity yet — messages appear here when clients post.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[3],
                }}
              >
                {activities.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: spacing[3],
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: borderRadius.full,
                        backgroundColor: item.dotColor,
                        marginTop: "6px",
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: typography.bodySm.size,
                          color: colors["text-primary"],
                        }}
                      >
                        {item.text}
                      </p>
                      <p
                        style={{
                          margin: `${spacing[1]} 0 0`,
                          fontSize: typography.captionSm.size,
                          color: colors["text-secondary"],
                        }}
                      >
                        {item.time}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Verbal commitments subsection */}
            <div>
              <h3
                style={{
                  margin: `0 0 ${spacing[3]} 0`,
                  fontSize: typography.labelMd.size,
                  fontWeight: 600,
                  color: colors["text-primary"],
                }}
              >
                Verbal commitments
              </h3>
              {isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height="40px" />
                  ))}
                </div>
              ) : commitments.length === 0 ? (
                <p style={{ margin: 0, color: colors["text-secondary"] }}>
                  No verbal commitments logged yet.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing[2],
                  }}
                >
                  {commitments.map((item) => (
                    <li
                      key={item.id}
                      style={{
                        padding: spacing[3],
                        backgroundColor: colors["surface-subtle"],
                        borderRadius: borderRadius.md,
                        border: `1px solid ${colors["border-default"]}`,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: typography.bodySm.size,
                          color: colors["text-primary"],
                        }}
                      >
                        {item.text}
                      </p>
                      <p
                        style={{
                          margin: `${spacing[1]} 0 0`,
                          fontSize: typography.captionSm.size,
                          color: colors["text-secondary"],
                        }}
                      >
                        {item.client}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default DashboardPage;
