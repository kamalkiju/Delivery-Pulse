// ─────────────────────────────────────────────
// ProfilePage — user profile, notifications, and security
// Layout per DeliveryPulse spec (Figma settings nav 82:1311; content from spec)
// ─────────────────────────────────────────────

import { useState, type CSSProperties } from "react";
import {
  ChevronRight,
  History,
  Lock,
  Shield,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import { borderRadius, colors, spacing, typography } from "../../styles/tokens";

// ── Types ────────────────────────────────────────────────────

type NotificationKey =
  | "clientHealthAlerts"
  | "sprintRiskWarnings"
  | "newStoryInReview"
  | "weeklySummary"
  | "meetingTranscript";

interface ProfileFormValues {
  fullName: string;
  workEmail: string;
  phone: string;
  role: string;
  department: string;
  timeZone: string;
}

// ── Shared styles ────────────────────────────────────────────

const cardBase: CSSProperties = {
  backgroundColor: colors["surface-card"],
  border: `1px solid ${colors["border-default"]}`,
  borderRadius: borderRadius.xl,
};

const sectionTitle: CSSProperties = {
  fontSize: typography.titleSm.size,
  fontWeight: "600",
  color: colors["text-primary"],
  margin: 0,
};

const fieldLabel: CSSProperties = {
  fontSize: typography.captionSm.size,
  color: colors["text-tertiary"],
  marginBottom: spacing[1],
};

const fieldValue: CSSProperties = {
  fontSize: typography.bodySm.size,
  color: colors["text-primary"],
  paddingBottom: spacing[3],
  borderBottom: `1px solid ${colors["border-default"]}`,
};

const linkButton: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: colors["brand-blue"],
  fontSize: typography.captionSm.size,
  fontWeight: typography.captionBold.weight,
};

// ── Toggle switch (40×22, green ON / gray OFF) ───────────────

interface ToggleProps {
  on: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

/** TOGGLE — 40×22 pill; ON #10b981 dot right, OFF #cbd5e1 dot left */
function Toggle({ on, onToggle, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-pressed={on}
      style={{
        width: 40,
        height: 22,
        borderRadius: borderRadius.full,
        border: "none",
        cursor: "pointer",
        backgroundColor: on ? colors.success : colors["border-light"],
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: borderRadius.full,
          backgroundColor: colors["surface-card"],
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

// ── Page component ───────────────────────────────────────────

export default function ProfilePage() {
  // isEditing — toggles personal info between read-only values and form inputs
  const [isEditing, setIsEditing] = useState(false);

  // formValues — editable profile fields when isEditing is true
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    fullName: "Rajesh M",
    workEmail: "rajesh.m@techsolutions.com",
    phone: "+91 98765 43210",
    role: "Delivery Head",
    department: "Engineering Delivery",
    timeZone: "IST (UTC +5:30)",
  });

  // notifications — each toggle key maps to ON/OFF state
  const [notifications, setNotifications] = useState<
    Record<NotificationKey, boolean>
  >({
    clientHealthAlerts: true,
    sprintRiskWarnings: true,
    newStoryInReview: true,
    weeklySummary: true,
    meetingTranscript: false,
  });

  const toggleNotification = (key: NotificationKey) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key: keyof ProfileFormValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const personalFields: {
    key: keyof ProfileFormValues;
    label: string;
  }[] = [
    { key: "fullName", label: "Full Name" },
    { key: "workEmail", label: "Work Email" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Role" },
    { key: "department", label: "Department" },
    { key: "timeZone", label: "Time Zone" },
  ];

  const notificationRows: { key: NotificationKey; label: string }[] = [
    { key: "clientHealthAlerts", label: "Client health alerts" },
    { key: "sprintRiskWarnings", label: "Sprint risk warnings" },
    { key: "newStoryInReview", label: "New story in review queue" },
    { key: "weeklySummary", label: "Weekly summary report" },
    { key: "meetingTranscript", label: "Meeting transcript ready" },
  ];

  return (
    <AppShell pageTitle="Profile">
      {/* PAGE WRAPPER — 720px max width, centered in AppShell main */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* PROFILE HEADER CARD — avatar, identity, stats, Edit Profile */}
        <section
          style={{
            ...cardBase,
            padding: "28px",
            marginBottom: spacing[5],
            display: "flex",
            gap: spacing[6],
            alignItems: "flex-start",
          }}
        >
          {/* AVATAR SECTION — 96px circle + Change photo link */}
          <div style={{ textAlign: "center", width: 120, flexShrink: 0 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: borderRadius.full,
                backgroundColor: colors["brand-blue"],
                color: colors["text-on-dark"],
                fontSize: typography.displayLg.size,
                fontWeight: typography.displayLg.weight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
              }}
            >
              RM
            </div>
            <button type="button" style={{ ...linkButton, marginTop: spacing[2] }}>
              Change photo
            </button>
          </div>

          {/* INFO SECTION — name, role badge, company, email, stats row */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: typography.titleXl.size,
                fontWeight: typography.titleXl.weight,
                color: colors["text-primary"],
              }}
            >
              Rajesh M
            </h1>
            <span
              style={{
                display: "inline-block",
                marginTop: spacing[2],
                padding: "4px 10px",
                borderRadius: borderRadius.full,
                backgroundColor: colors["info-bg"],
                color: "#1e40af",
                fontSize: typography.captionSm.size,
                fontWeight: typography.captionBold.weight,
              }}
            >
              Delivery Head
            </span>
            <p
              style={{
                margin: `${spacing[2]} 0 0`,
                fontSize: typography.bodySm.size,
                color: colors["text-secondary"],
              }}
            >
              TechSolutions Pvt Ltd
            </p>
            <p
              style={{
                margin: `${spacing[1]} 0 0`,
                fontSize: typography.bodySm.size,
                color: colors["text-tertiary"],
              }}
            >
              rajesh.m@techsolutions.com
            </p>

            {/* STATS ROW — Stories reviewed · Clients managed · Response rate */}
            <div
              style={{
                marginTop: spacing[4],
                display: "flex",
                gap: spacing[6],
                flexWrap: "wrap",
              }}
            >
              {[
                { value: "47", label: "Stories reviewed" },
                { value: "12", label: "Clients managed" },
                { value: "94%", label: "Response rate" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div
                    style={{
                      fontSize: typography.titleMd.size,
                      fontWeight: "700",
                      color: colors["text-primary"],
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: typography.captionSm.size,
                      color: colors["text-tertiary"],
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE — Edit Profile outline button + last login timestamp */}
          <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              style={{
                padding: "8px 16px",
                borderRadius: borderRadius.md,
                border: `1px solid ${colors["brand-blue"]}`,
                backgroundColor: "transparent",
                color: colors["brand-blue"],
                fontSize: typography.bodySm.size,
                fontWeight: typography.labelMd.weight,
                cursor: "pointer",
              }}
            >
              Edit Profile
            </button>
            <p
              style={{
                margin: `${spacing[2]} 0 0`,
                fontSize: typography.microBold.size,
                fontWeight: "400",
                color: colors["text-tertiary"],
              }}
            >
              Last seen Today 9:41 AM
            </p>
          </div>
        </section>

        {/* PERSONAL INFORMATION CARD — 2-column grid; Edit toggles isEditing */}
        <section
          style={{
            ...cardBase,
            padding: spacing[6],
            marginBottom: spacing[4],
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing[5],
            }}
          >
            <h2 style={sectionTitle}>Personal Information</h2>
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              style={linkButton}
            >
              {isEditing ? "Save" : "Edit"}
            </button>
          </div>

          {/* FORM GRID — labels + values (or inputs when isEditing) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: spacing[5],
            }}
          >
            {personalFields.map((field) => (
              <div key={field.key}>
                <div style={fieldLabel}>{field.label}</div>
                {isEditing ? (
                  <input
                    type="text"
                    value={formValues[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      fontSize: typography.bodySm.size,
                      color: colors["text-primary"],
                      paddingBottom: spacing[3],
                      border: "none",
                      borderBottom: `1px solid ${colors["border-default"]}`,
                      outline: "none",
                      background: "transparent",
                    }}
                  />
                ) : (
                  <div style={fieldValue}>{formValues[field.key]}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* NOTIFICATION PREFERENCES CARD — five toggle rows */}
        <section
          style={{
            ...cardBase,
            padding: spacing[6],
            marginBottom: spacing[4],
          }}
        >
          <h2 style={{ ...sectionTitle, marginBottom: spacing[2] }}>
            Notification Preferences
          </h2>

          {notificationRows.map((row, index) => (
            // TOGGLE ROW — label left, Toggle right; state in notifications[key]
            <div
              key={row.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: `${spacing[3]} 0`,
                borderBottom:
                  index < notificationRows.length - 1
                    ? `1px solid ${colors["border-default"]}`
                    : "none",
              }}
            >
              <span
                style={{
                  fontSize: typography.bodySm.size,
                  color: colors["text-primary"],
                }}
              >
                {row.label}
              </span>
              <Toggle
                on={notifications[row.key]}
                onToggle={() => toggleNotification(row.key)}
                ariaLabel={`Toggle ${row.label}`}
              />
            </div>
          ))}
        </section>

        {/* SECURITY CARD — password, 2FA, login history action rows */}
        <section
          style={{
            ...cardBase,
            padding: spacing[6],
            marginBottom: spacing[4],
          }}
        >
          <h2 style={{ ...sectionTitle, marginBottom: spacing[2] }}>Security</h2>

          {/* Change Password row */}
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: `${spacing[3]} 0`,
              border: "none",
              borderBottom: `1px solid ${colors["border-default"]}`,
              background: "none",
              cursor: "pointer",
              textAlign: "left",
              gap: spacing[3],
            }}
          >
            <Lock size={18} color={colors["text-tertiary"]} />
            <span
              style={{
                flex: 1,
                fontSize: typography.bodySm.size,
                color: colors["text-primary"],
              }}
            >
              Change Password
            </span>
            <ChevronRight size={18} color={colors["text-tertiary"]} />
          </button>

          {/* Two-Factor Authentication row */}
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: `${spacing[3]} 0`,
              border: "none",
              borderBottom: `1px solid ${colors["border-default"]}`,
              background: "none",
              cursor: "pointer",
              textAlign: "left",
              gap: spacing[3],
            }}
          >
            <Shield size={18} color={colors["text-tertiary"]} />
            <span
              style={{
                flex: 1,
                fontSize: typography.bodySm.size,
                color: colors["text-primary"],
              }}
            >
              Two-Factor Authentication
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: borderRadius.full,
                backgroundColor: colors["warning-bg"],
                color: colors["warning-dark"],
                fontSize: typography.captionSm.size,
                fontWeight: typography.captionBold.weight,
                marginRight: spacing[2],
              }}
            >
              Not enabled
            </span>
            <ChevronRight size={18} color={colors["text-tertiary"]} />
          </button>

          {/* Login History row */}
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: `${spacing[3]} 0`,
              border: "none",
              background: "none",
              cursor: "pointer",
              textAlign: "left",
              gap: spacing[3],
            }}
          >
            <History size={18} color={colors["text-tertiary"]} />
            <span
              style={{
                flex: 1,
                fontSize: typography.bodySm.size,
                color: colors["text-primary"],
              }}
            >
              Login History
            </span>
            <span
              style={{
                fontSize: typography.captionSm.size,
                color: colors["brand-blue"],
                marginRight: spacing[2],
              }}
            >
              View 12 sessions
            </span>
            <ChevronRight size={18} color={colors["text-tertiary"]} />
          </button>
        </section>

        {/* DANGER ZONE CARD — sign out all devices + delete account */}
        <section
          style={{
            backgroundColor: "#fff5f5",
            border: "1px solid #fca5a5",
            borderRadius: borderRadius.xl,
            padding: spacing[5],
          }}
        >
          <h2
            style={{
              margin: `0 0 ${spacing[4]}`,
              fontSize: typography.bodySm.size,
              fontWeight: "700",
              color: colors.danger,
            }}
          >
            Danger Zone
          </h2>

          {/* Sign out of all devices */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing[3],
            }}
          >
            <span style={{ fontSize: typography.bodySm.size, color: colors["text-primary"] }}>
              Sign out of all devices
            </span>
            <button
              type="button"
              style={{
                padding: "6px 14px",
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.danger}`,
                backgroundColor: "transparent",
                color: colors.danger,
                fontSize: typography.captionSm.size,
                fontWeight: typography.captionBold.weight,
                cursor: "pointer",
              }}
            >
              Sign Out All
            </button>
          </div>

          {/* Delete account */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: typography.bodySm.size, color: colors["text-primary"] }}>
              Delete account
            </span>
            <button
              type="button"
              style={{
                padding: "6px 14px",
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.danger}`,
                backgroundColor: "transparent",
                color: colors.danger,
                fontSize: typography.captionSm.size,
                fontWeight: typography.captionBold.weight,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
