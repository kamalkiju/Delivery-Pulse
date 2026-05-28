// Figma: screen-onboarding-wizard (2:85), invite-team (24:661), connect tools (24:754)
import { AudioLines, Check } from "lucide-react";
import type { ReactNode } from "react";
import { borderRadius, colors, spacing, typography } from "../../styles/tokens";

export type OnboardingStepId = 1 | 2 | 3;

const STEPS: { id: OnboardingStepId; label: string }[] = [
  { id: 1, label: "Workspace Setup" },
  { id: 2, label: "Invite Team" },
  { id: 3, label: "Connect Tools" },
];

interface OnboardingShellProps {
  step: OnboardingStepId;
  heroTitle: string;
  heroFooter: string;
  stepBadge: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function OnboardingShell({
  step,
  heroTitle,
  heroFooter,
  stepBadge,
  title,
  subtitle,
  children,
}: OnboardingShellProps) {
  return (
    <div
      data-name="screen-onboarding"
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        backgroundColor: colors.canvas,
      }}
    >
      <aside
        data-name="onboarding-left"
        style={{
          width: "480px",
          minHeight: "100vh",
          backgroundColor: colors["navy-sidebar"],
          padding: spacing[8],
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
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

        <div>
          <h1
            style={{
              margin: `0 0 ${spacing[6]} 0`,
              fontSize: typography.heroLg.size,
              fontWeight: typography.heroLg.weight,
              color: colors["text-on-dark"],
              lineHeight: 1.2,
            }}
          >
            {heroTitle}
          </h1>
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
            {STEPS.map((s) => {
              const completed = s.id < step;
              const active = s.id === step;
              return (
                <li
                  key={s.id}
                  style={{ display: "flex", alignItems: "center", gap: spacing[3] }}
                >
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: borderRadius.xl,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: completed
                        ? colors.success
                        : active
                          ? colors["surface-card"]
                          : "rgba(255,255,255,0.08)",
                      border: active
                        ? "none"
                        : "1px solid rgba(255,255,255,0.12)",
                      color: completed
                        ? colors["text-on-dark"]
                        : active
                          ? colors["navy-sidebar"]
                          : "rgba(255,255,255,0.7)",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {completed ? (
                      <Check size={14} strokeWidth={3} aria-hidden />
                    ) : (
                      s.id
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: typography.listTitle.size,
                      fontWeight: active ? 700 : 600,
                      color: active
                        ? colors["text-on-dark"]
                        : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: typography.bodySm.size,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.5,
          }}
        >
          {heroFooter}
        </p>
      </aside>

      <main
        data-name="onboarding-right"
        style={{
          flex: 1,
          backgroundColor: colors["surface-card"],
          padding: `${spacing[10]} ${spacing[12]}`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: spacing[6],
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: spacing[4],
          }}
        >
          <div>
            <h2
              style={{
                margin: `0 0 ${spacing[2]} 0`,
                fontSize: typography.displayMd.size,
                fontWeight: typography.displayMd.weight,
                color: colors["navy-auth"],
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: typography.bodySm.size,
                color: colors["text-secondary"],
              }}
            >
              {subtitle}
            </p>
          </div>
          <span
            style={{
              flexShrink: 0,
              padding: "6px 10px",
              borderRadius: borderRadius.full,
              backgroundColor: "rgba(0, 136, 255, 0.08)",
              border: "1px solid rgba(37, 99, 235, 0.2)",
              fontSize: typography.captionBold.size,
              fontWeight: typography.captionBold.weight,
              color: colors["brand-blue"],
            }}
          >
            {stepBadge}
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
