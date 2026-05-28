import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import AuthButton from "../../components/auth/AuthButton";
import AuthField from "../../components/auth/AuthField";
import OnboardingShell from "../../components/onboarding/OnboardingShell";
import { completeOnboardingApi } from "../../api/auth.api";
import OnboardingSlackStep from "../../components/onboarding/OnboardingSlackStep";
import { markOnboardingComplete } from "../../utils/onboarding";
import { borderRadius, colors, spacing, typography } from "../../styles/tokens";

const TEAM_SIZES = ["1-5", "6-20", "21-50", "50+"] as const;
const ROLES = ["BA", "PM", "Delivery Manager", "Developer", "Other"];
const INDUSTRIES = [
  "IT Services",
  "Consulting",
  "Software Development",
  "Other",
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState<string>("6-20");
  const [industry, setIndustry] = useState("IT Services");
  const [inviteEmail, setInviteEmail] = useState("");
  const [slackConnected, setSlackConnected] = useState(false);
  const [oauthTeamName, setOauthTeamName] = useState<string | null>(null);
  const [oauthWorkspaceId, setOauthWorkspaceId] = useState<string | null>(null);

  const [oauthSuccess, setOauthSuccess] = useState(false);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (stepParam === "3") {
      setStep(3);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const connected =
      searchParams.get("slack") === "connected" ||
      searchParams.get("connected") === "true";
    if (connected) {
      setSlackConnected(true);
      setOauthSuccess(true);
      const team = searchParams.get("team") ?? searchParams.get("workspace");
      if (team) setOauthTeamName(team);
      const wsId = searchParams.get("workspaceId");
      if (wsId) setOauthWorkspaceId(wsId);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const finishSetup = async () => {
    setIsSaving(true);
    try {
      const user = await completeOnboardingApi();
      markOnboardingComplete(user.id);
      navigate("/dashboard", { replace: true });
    } catch {
      navigate("/dashboard", { replace: true });
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 1) {
    return (
      <OnboardingShell
        step={1}
        heroTitle="Set up your AI delivery intelligence in minutes"
        heroFooter="Join 500+ IT delivery teams catching risks before clients do."
        stepBadge="1 of 3"
        title="Set up your workspace"
        subtitle="Tell us about your organization so we can personalize your experience"
      >
        <AuthField
          label="Organization Name"
          placeholder="e.g. TechCorp Solutions"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />
        <label
          style={{
            display: "block",
            fontSize: typography.labelMd.size,
            fontWeight: typography.labelMd.weight,
            color: colors["text-secondary"],
            marginBottom: spacing[2],
          }}
        >
          Your Role
        </label>
        <select
          className="dp-select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            width: "100%",
            height: "48px",
            marginBottom: spacing[5],
            padding: `0 ${spacing[3]}`,
            borderRadius: borderRadius.xl,
            fontSize: typography.bodySm.size,
            color: colors["text-primary"],
            backgroundColor: colors["surface-card"],
          }}
        >
          <option value="">Select a role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <p
          style={{
            margin: `0 0 ${spacing[2]} 0`,
            fontSize: typography.labelMd.size,
            fontWeight: typography.labelMd.weight,
            color: colors["text-secondary"],
          }}
        >
          Team Size
        </p>
        <div
          style={{
            display: "flex",
            gap: spacing[2],
            marginBottom: spacing[5],
          }}
        >
          {TEAM_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`dp-segment ${teamSize === size ? "dp-segment--active" : ""}`}
              onClick={() => setTeamSize(size)}
              style={{ flex: 1, height: "44px" }}
            >
              {size}
            </button>
          ))}
        </div>

        <label
          style={{
            display: "block",
            fontSize: typography.labelMd.size,
            fontWeight: typography.labelMd.weight,
            color: colors["text-secondary"],
            marginBottom: spacing[2],
          }}
        >
          Industry
        </label>
        <div style={{ position: "relative", marginBottom: spacing[6] }}>
          <select
            className="dp-select"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{
              width: "100%",
              height: "48px",
              padding: `0 ${spacing[3]}`,
              borderRadius: borderRadius.xl,
              fontSize: typography.bodySm.size,
              appearance: "none",
            }}
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            style={{
              position: "absolute",
              right: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: colors["text-tertiary"],
            }}
            aria-hidden
          />
        </div>

        <AuthButton
          variant="primary"
          fullWidth
          disabled={!orgName.trim()}
          onClick={() => setStep(2)}
        >
          Continue
        </AuthButton>
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <OnboardingShell
        step={2}
        heroTitle="Better delivery intelligence starts with the whole team"
        heroFooter="Teams using DeliveryPulse together reduce delivery surprises by 73%."
        stepBadge="2 of 3"
        title="Invite your team"
        subtitle="Add colleagues who manage or contribute to IT delivery"
      >
        <div style={{ marginBottom: spacing[6] }}>
          <p
            style={{
              margin: `0 0 ${spacing[2]} 0`,
              fontSize: typography.labelMd.size,
              fontWeight: typography.labelMd.weight,
              color: colors["text-secondary"],
            }}
          >
            Invite by email
          </p>
          <div style={{ display: "flex", gap: spacing[3] }}>
            <AuthField
              label=""
              aria-label="Invite email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            <AuthButton
              variant="primary"
              style={{ alignSelf: "flex-end", height: "48px", flexShrink: 0 }}
            >
              Send Invite
            </AuthButton>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          <button
            type="button"
            className="dp-btn dp-btn-ghost"
            onClick={() => setStep(3)}
          >
            Skip for now
          </button>
          <AuthButton variant="primary" onClick={() => setStep(3)}>
            Continue <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </AuthButton>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={3}
      heroTitle="Connect your tools, unlock your delivery intelligence"
      heroFooter="You can add more integrations anytime from Settings."
      stepBadge="3 of 3"
      title="Connect Slack"
      subtitle="Link your workspace so DeliveryPulse can monitor client messages and create stories"
    >
      <OnboardingSlackStep
        oauthSuccess={oauthSuccess}
        oauthTeamName={oauthTeamName}
        workspaceId={oauthWorkspaceId}
        onConnectionChange={setSlackConnected}
      />

      <AuthButton
        variant="primary"
        fullWidth
        disabled={isSaving || !slackConnected}
        onClick={finishSetup}
        style={{ marginTop: spacing[6] }}
      >
        {isSaving ? "Finishing…" : "Finish Setup"} <ArrowRight size={16} />
      </AuthButton>

      {!slackConnected && (
        <p
          style={{
            textAlign: "center",
            margin: `${spacing[3]} 0 0 0`,
            fontSize: typography.captionSm.size,
            color: colors["text-tertiary"],
          }}
        >
          Connect Slack to continue
        </p>
      )}
    </OnboardingShell>
  );
}
