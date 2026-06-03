// ClientsPage — list of all organisation clients with health scores
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllClients, type ClientSummary } from "../../api/clients.api";
import AppShell from "../../components/layout/AppShell";
import StatusBadge, { type BadgeVariant } from "../../components/ui/StatusBadge";
import { borderRadius, colors, spacing, typography } from "../../styles/tokens";

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.danger;
}

function Skeleton() {
  return (
    <div
      className="dashboard-skeleton"
      style={{
        height: 20,
        width: "60%",
        backgroundColor: colors["border-default"],
        borderRadius: borderRadius.xs,
      }}
    />
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllClients()
      .then(setClients)
      .catch(() => setError("Could not load clients."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AppShell pageTitle="Clients">
      <div
        style={{
          backgroundColor: colors["surface-card"],
          border: `1px solid ${colors["border-default"]}`,
          borderRadius: borderRadius.md,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: spacing[5],
            borderBottom: `1px solid ${colors["border-default"]}`,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: typography.titleMd.size,
              fontWeight: 700,
              color: colors["text-primary"],
            }}
          >
            Clients
          </h1>
        </div>

        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 200px 100px 120px",
            padding: "10px 20px",
            backgroundColor: colors["surface-subtle"],
            borderBottom: `1px solid ${colors["border-default"]}`,
          }}
        >
          {["CLIENT", "COMPANY", "SCORE", "STATUS"].map((col) => (
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

        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${colors["border-default"]}`,
              }}
            >
              <Skeleton />
            </div>
          ))
        ) : error ? (
          <p style={{ padding: spacing[5], color: colors.danger, margin: 0 }}>
            {error}
          </p>
        ) : clients.length === 0 ? (
          <p
            style={{
              padding: spacing[5],
              color: colors["text-secondary"],
              margin: 0,
            }}
          >
            No clients yet. Connect a Slack channel to a client to get started.
          </p>
        ) : (
          clients.map((client) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px 100px 120px",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: `1px solid ${colors["border-default"]}`,
                textDecoration: "none",
                backgroundColor: colors["surface-card"],
              }}
            >
              <span
                style={{
                  fontSize: typography.bodySm.size,
                  fontWeight: 600,
                  color: colors["text-primary"],
                }}
              >
                {client.name}
              </span>
              <span
                style={{
                  fontSize: typography.bodySm.size,
                  color: colors["text-secondary"],
                }}
              >
                {client.company}
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
              <StatusBadge variant={(client.status ?? "healthy") as BadgeVariant} />
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
