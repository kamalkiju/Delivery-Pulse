import type { ReactNode } from "react";
import { AudioLines } from "lucide-react";
import { colors, spacing, typography } from "../../styles/tokens";

interface AuthLayoutProps {
  heroTitle: string;
  heroSubtitle: string;
  children: ReactNode;
}

export default function AuthLayout({
  heroTitle,
  heroSubtitle,
  children,
}: AuthLayoutProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <div
        style={{
          width: "55%",
          backgroundColor: colors["navy-sidebar"],
          padding: spacing[20],
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            marginBottom: spacing[10],
          }}
        >
          <AudioLines size={20} color={colors["text-on-dark"]} aria-hidden />
          <span
            style={{
              fontSize: typography.brandName.size,
              fontWeight: typography.brandName.weight,
              color: colors["text-on-dark"],
            }}
          >
            DeliveryPulse
          </span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: typography.heroXl.size,
            fontWeight: typography.heroXl.weight,
            color: colors["text-on-dark"],
            lineHeight: 1.1,
            maxWidth: "420px",
          }}
        >
          {heroTitle}
        </h1>
        <p
          style={{
            marginTop: spacing[6],
            fontSize: typography.bodyMd.size,
            color: "rgba(255,255,255,0.7)",
            maxWidth: "420px",
          }}
        >
          {heroSubtitle}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: colors["surface-card"],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[20],
          boxSizing: "border-box",
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        <div style={{ width: "360px", maxWidth: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
