import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import {
  getAuthErrorMessage,
  signupSetPassword,
  signupStartEmail,
  signupVerifyEmail,
} from "../../api/auth.api";
import AuthButton from "../../components/auth/AuthButton";
import AuthField from "../../components/auth/AuthField";
import AuthLayout from "../../components/auth/AuthLayout";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/tokens";
import {
  validateEmail,
  validatePasswordPair,
  validateVerificationCode,
} from "../../utils/authValidation";

type SignupStep = "email" | "verify" | "password";

export default function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SignupStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [signupToken, setSignupToken] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const passwordsValid =
    validatePasswordPair(password, confirmPassword) === null &&
    name.trim().length >= 2 &&
    orgName.trim().length > 0;

  const handleStart = async () => {
    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldError(emailErr);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setFieldError(null);
    try {
      const res = await signupStartEmail(email.trim());
      setDevCodeHint(res.devCode ?? null);
      setStep("verify");
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? getAuthErrorMessage(err, "Could not send verification code.")
          : "Unable to connect to server.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    const codeErr = validateVerificationCode(code);
    if (codeErr) {
      setFieldError(codeErr);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setFieldError(null);
    try {
      const res = await signupVerifyEmail(email.trim(), code.trim());
      setSignupToken(res.signupToken);
      setStep("password");
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? getAuthErrorMessage(err, "Invalid verification code.")
          : "Unable to connect to server.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async () => {
    const pwdErr = validatePasswordPair(password, confirmPassword);
    if (pwdErr) {
      setFieldError(pwdErr);
      setError(null);
      return;
    }
    if (name.trim().length < 2) {
      setFieldError("Name must be at least 2 characters");
      setError(null);
      return;
    }
    if (!orgName.trim()) {
      setFieldError("Organisation name is required");
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setFieldError(null);
    try {
      await signupSetPassword({
        signupToken,
        password,
        confirmPassword,
        name: name.trim(),
        orgName: orgName.trim(),
      });
      navigate(
        `/login?registered=1&email=${encodeURIComponent(email.trim())}`,
        { replace: true },
      );
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? getAuthErrorMessage(err, "Could not create account.")
          : "Unable to connect to server.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles: Record<SignupStep, { title: string; sub: string }> = {
    email: {
      title: "Create your account",
      sub: "Enter your work email — we'll send a verification code",
    },
    verify: {
      title: "Verify your email",
      sub: `Enter the 6-digit code sent to ${email}`,
    },
    password: {
      title: "Set your password",
      sub: "Choose a secure password and confirm it",
    },
  };

  const { title, sub } = stepTitles[step];

  return (
    <AuthLayout
      heroTitle="Create your workspace in minutes"
      heroSubtitle="Verify your email, set a password, then sign in to DeliveryPulse."
    >
      <p
        style={{
          margin: `0 0 ${spacing[4]} 0`,
          fontSize: typography.captionSm.size,
          color: colors["text-tertiary"],
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Step {step === "email" ? 1 : step === "verify" ? 2 : 3} of 3
      </p>

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
          margin: `0 0 ${spacing[6]} 0`,
          fontSize: typography.bodySm.size,
          color: colors["text-secondary"],
        }}
      >
        {sub}
      </p>

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

      {step === "email" && (
        <>
          <AuthField
            label="Work email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(null);
            }}
            error={fieldError}
            placeholder="you@company.com"
            autoComplete="email"
          />
          <AuthButton
            variant="primary"
            fullWidth
            disabled={isLoading || !email.trim()}
            onClick={handleStart}
          >
            {isLoading ? "Sending code…" : "Continue"}
            {!isLoading && <ArrowRight size={18} aria-hidden />}
          </AuthButton>
        </>
      )}

      {step === "verify" && (
        <>
          {devCodeHint != null && (
            <p
              style={{
                margin: `0 0 ${spacing[4]} 0`,
                padding: spacing[3],
                backgroundColor: colors["surface-blue-tint"],
                borderRadius: borderRadius.md,
                fontSize: typography.captionMd.size,
                color: colors["brand-blue"],
              }}
            >
              Dev mode — your code is: <strong>{devCodeHint}</strong>
            </p>
          )}
          <AuthField
            label="Verification code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setFieldError(null);
            }}
            error={fieldError}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <AuthButton
            variant="primary"
            fullWidth
            disabled={isLoading || code.length !== 6}
            onClick={handleVerify}
            style={{ marginBottom: spacing[3] }}
          >
            {isLoading ? "Verifying…" : "Verify email"}
          </AuthButton>
          <button
            type="button"
            className="dp-auth-link"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              display: "block",
              margin: "0 auto",
            }}
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Use a different email
          </button>
        </>
      )}

      {step === "password" && (
        <>
          <AuthField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <AuthField
            label="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Your company"
          />
          <AuthField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
          <AuthField
            label="Confirm password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            error={
              confirmPassword.length > 0 && password !== confirmPassword
                ? "Passwords do not match"
                : null
            }
            rightSlot={
              <button
                type="button"
                className="dp-field-icon-btn"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <AuthButton
            variant="primary"
            fullWidth
            disabled={isLoading || !passwordsValid}
            onClick={handleSetPassword}
          >
            {isLoading ? "Creating account…" : "Create account"}
          </AuthButton>
        </>
      )}

      <p
        style={{
          margin: `${spacing[6]} 0 0`,
          textAlign: "center",
          fontSize: typography.bodySm.size,
          color: colors["text-secondary"],
        }}
      >
        Already have an account?{" "}
        <Link to="/login" className="dp-auth-link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
