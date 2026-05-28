// ─────────────────────────────────────────────
// LoginPage — split-screen auth (no AppShell / no sidebar)
// Figma: screen-login (node 2:7)
// ─────────────────────────────────────────────

import { useState } from "react"; // useState stores values that change when the user types or clicks
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  AudioLines,
  Check,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { getAuthErrorMessage, loginUser } from "../../api/auth.api";
import AuthButton from "../../components/auth/AuthButton";
import AuthField from "../../components/auth/AuthField";
import { getPostAuthPath } from "../../utils/authRedirect";
import { validateLoginFields } from "../../utils/authValidation";
import { markOnboardingComplete } from "../../utils/onboarding";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";
import axios from "axios";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const passwordReset = searchParams.get("reset") === "1";
  const prefilledEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState(""); // Stores the password field value; starts empty
  const [isLoading, setIsLoading] = useState(false); // true while the API request is in flight
  const [error, setError] = useState<string | null>(null); // null = no error; string = message to show in red box
  const [showPassword, setShowPassword] = useState(false); // false = hide password dots; true = show plain text

  const handleLogin = async () => {
    const validationError = validateLoginFields(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await loginUser(email, password);
      if (res.user.onboardingCompleted || res.needsOnboarding === false) {
        markOnboardingComplete(res.user.id);
      }
      navigate(getPostAuthPath(res.user, res.needsOnboarding), { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          getAuthErrorMessage(err, "Something went wrong. Please try again."),
        );
      } else {
        setError("Unable to connect to server. Check your internet connection.");
      }
    } finally {
      setIsLoading(false); // Always turn off loading, whether success or failure
    }
  };

  return (
    <div
      data-node-id="2:7"
      data-name="screen-login"
      style={{
        display: "flex", // Side-by-side: left marketing panel + right form
        minHeight: "100vh", // Full viewport height
        width: "100%", // Span entire browser width
      }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div
        data-name="login-left"
        style={{
          width: "55%", // ~792px of 1440px in Figma
          backgroundColor: colors["navy-sidebar"], // #1c2655
          padding: spacing[20], // 80px on all sides
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between", // Logo/content top area, preview card at bottom
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle diagonal grid texture (simplified vs Figma decorative lines) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 64px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Logo lock-up */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[2],
              marginBottom: spacing[10],
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                backgroundColor: colors["surface-card"],
                borderRadius: borderRadius.md,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AudioLines
                size={20}
                color={colors["navy-sidebar"]}
                aria-hidden
              />
            </div>
            <span
              style={{
                fontSize: typography.brandName.size, // 20px
                fontWeight: typography.brandName.weight, // 700 Bold
                letterSpacing: typography.brandName.letterSpacing, // -0.5px
                color: colors["text-on-dark"],
              }}
            >
              DeliveryPulse
            </span>
          </div>

          {/* Hero headline */}
          <h1
            style={{
              margin: `0 0 ${spacing[6]} 0`,
              fontSize: typography.heroXl.size, // 48px Bold
              fontWeight: typography.heroXl.weight,
              color: colors["text-on-dark"],
              lineHeight: "110%",
              maxWidth: "420px",
            }}
          >
            Stop finding out about client{" "}
            <span style={{ color: "#3b82f6" }}>problems</span> too late
          </h1>

          {/* Feature bullets with checkmarks */}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: spacing[4],
              maxWidth: "420px",
            }}
          >
            {[
              "Auto-create ADO stories from Slack messages, screenshots & docs",
              "Live client health scores — know who's at risk before they complain",
              "AI listens to Teams meetings and creates stories from what was said",
            ].map((text) => (
              <li
                key={text}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: spacing[3],
                }}
              >
                <span
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: borderRadius.xl,
                    backgroundColor: "rgba(0, 136, 255, 0.1)",
                    border: "1px solid rgba(37, 99, 235, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Check size={14} color={colors["brand-blue"]} aria-hidden />
                </span>
                <span
                  style={{
                    fontSize: typography.bodyMd.size,
                    color: colors["text-on-dark"],
                    lineHeight: 1.4,
                  }}
                >
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mini preview card — live health score teaser */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: borderRadius.md,
            padding: spacing[4],
            maxWidth: "420px",
          }}
        >
          <p
            style={{
              margin: `0 0 ${spacing[2]} 0`,
              fontSize: typography.monoSm.size,
              color: "rgba(255, 255, 255, 0.5)",
            }}
          >
            Live preview
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: colors.success,
              }}
            >
              87
            </span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.bodySm.size,
                  fontWeight: 600,
                  color: colors["text-on-dark"],
                }}
              >
                TechCorp — Healthy
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: typography.monoSm.size,
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                Response 1.2h · On-time 94%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div
        data-name="login-right"
        style={{
          flex: 1,
          backgroundColor: colors["surface-card"],
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: `${spacing[10]} ${spacing[8]}`,
          boxSizing: "border-box",
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        <div
          data-testid="login-form"
          style={{ width: "360px", maxWidth: "100%", paddingBottom: spacing[8] }}
        >
          {/* Form header */}
          <div style={{ marginBottom: spacing[6] }}>
            <h2
              style={{
                margin: `0 0 ${spacing[2]} 0`,
                fontSize: typography.displayMd.size, // 28px Bold
                fontWeight: typography.displayMd.weight,
                color: colors["navy-auth"], // #2e3b61
              }}
            >
              Welcome back
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: typography.bodySm.size,
                color: colors["text-secondary"],
              }}
            >
              Sign in to your DeliveryPulse workspace
            </p>
          </div>

          {registered && (
            <div
              role="status"
              style={{
                backgroundColor: colors["surface-blue-tint"],
                border: `1px solid ${colors["brand-blue"]}`,
                borderRadius: borderRadius.md,
                padding: "10px 14px",
                marginBottom: spacing[5],
                fontSize: typography.bodySm.size,
                color: colors["brand-blue"],
              }}
            >
              Account created. Sign in with your email and password.
            </div>
          )}

          {passwordReset && (
            <div
              role="status"
              style={{
                backgroundColor: colors["surface-blue-tint"],
                border: `1px solid ${colors["brand-blue"]}`,
                borderRadius: borderRadius.md,
                padding: "10px 14px",
                marginBottom: spacing[5],
                fontSize: typography.bodySm.size,
                color: colors["brand-blue"],
              }}
            >
              Password updated. Sign in with your new password.
            </div>
          )}

          {/* Error banner */}
          {error != null && (
            <div
              role="alert"
              style={{
                backgroundColor: colors["danger-bg"],
                border: "1px solid #fca5a5",
                borderRadius: borderRadius.md,
                padding: "10px 14px",
                marginBottom: spacing[5],
                fontSize: typography.bodySm.size,
                color: colors["danger-dark"],
              }}
            >
              {error}
            </div>
          )}

          <AuthField
            label="Work email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />

          <AuthField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            rightSlot={
              <button
                type="button"
                className="dp-field-icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />

          <div style={{ margin: `0 0 ${spacing[6]} 0`, textAlign: "right" }}>
            <button
              type="button"
              className="dp-auth-link"
              onClick={() => navigate("/forgot-password")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: typography.bodySm.size,
                fontWeight: 600,
              }}
            >
              Forgot password?
            </button>
          </div>

          <AuthButton
            variant="primary"
            fullWidth
            disabled={isLoading}
            onClick={handleLogin}
            style={{ marginBottom: spacing[3], marginTop: spacing[2] }}
          >
            {isLoading ? "Signing in..." : "Sign In"}
            {!isLoading && <ArrowRight size={18} aria-hidden />}
          </AuthButton>

          <AuthButton
            variant="outline"
            fullWidth
            type="button"
            data-testid="signup-button"
            className="dp-btn-signup-login"
            onClick={() => navigate("/signup")}
            style={{ marginBottom: spacing[5] }}
          >
            <UserPlus size={18} aria-hidden />
            Sign up — Create account
          </AuthButton>

          {/* OR divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              marginBottom: spacing[6],
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: colors["border-default"],
              }}
            />
            <span
              style={{
                fontSize: typography.bodySm.size,
                color: colors["text-tertiary"],
              }}
            >
              OR
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: colors["border-default"],
              }}
            />
          </div>

          {/* Microsoft SSO */}
          <AuthButton
            variant="outline"
            fullWidth
            style={{ marginBottom: spacing[3] }}
          >
            <span
              style={{
                width: "18px",
                height: "18px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: typography.captionSm.size,
                fontWeight: 700,
              }}
              aria-hidden
            >
              MS
            </span>
            Continue with Microsoft
          </AuthButton>

          <p
            style={{
              margin: `${spacing[6]} 0 0`,
              textAlign: "center",
              fontSize: typography.bodySm.size,
              color: colors["text-secondary"],
            }}
          >
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="dp-auth-link" data-testid="signup-link">
              Create a free account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
