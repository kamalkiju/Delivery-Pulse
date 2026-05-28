import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import {
  forgotPasswordReset,
  forgotPasswordStart,
  forgotPasswordVerify,
  getAuthErrorMessage,
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

type Step = "email" | "verify" | "password";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const passwordValidationError = validatePasswordPair(password, confirmPassword);
  const passwordsValid = passwordValidationError === null && password.length > 0;

  const titles: Record<Step, { title: string; sub: string }> = {
    email: {
      title: "Reset your password",
      sub: "Enter your work email and we'll send a verification code",
    },
    verify: {
      title: "Verify your email",
      sub: `Enter the 6-digit code sent to ${email}`,
    },
    password: {
      title: "Set new password",
      sub: "Enter and confirm your new password",
    },
  };

  const { title, sub } = titles[step];

  return (
    <AuthLayout
      heroTitle="Forgot your password?"
      heroSubtitle="We'll verify your email, then you can set a new password and sign in."
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
            onClick={async () => {
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
                const res = await forgotPasswordStart(email.trim());
                setDevCodeHint(res.devCode ?? null);
                setStep("verify");
              } catch (err) {
                setError(
                  axios.isAxiosError(err)
                    ? getAuthErrorMessage(err, "Could not send reset code.")
                    : "Unable to connect to server.",
                );
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? "Sending…" : "Send reset code"}
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
          />
          <AuthButton
            variant="primary"
            fullWidth
            disabled={isLoading || code.length !== 6}
            onClick={async () => {
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
                const res = await forgotPasswordVerify(email.trim(), code.trim());
                setResetToken(res.resetToken);
                setStep("password");
              } catch (err) {
                setError(
                  axios.isAxiosError(err)
                    ? getAuthErrorMessage(err, "Invalid code.")
                    : "Unable to connect to server.",
                );
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? "Verifying…" : "Verify code"}
          </AuthButton>
        </>
      )}

      {step === "password" && (
        <>
          <p
            style={{
              margin: `0 0 ${spacing[4]} 0`,
              fontSize: typography.captionMd.size,
              color: colors["text-tertiary"],
            }}
          >
            At least 8 characters, including one number.
          </p>
          <AuthField
            label="New password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldError(null);
            }}
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
            label="Confirm new password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={
              confirmPassword.length > 0 && password !== confirmPassword
                ? "Passwords do not match"
                : fieldError && step === "password"
                  ? fieldError
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
            onClick={async () => {
              const pwdErr = validatePasswordPair(password, confirmPassword);
              if (pwdErr) {
                setFieldError(pwdErr);
                setError(null);
                return;
              }
              setIsLoading(true);
              setError(null);
              setFieldError(null);
              try {
                await forgotPasswordReset({
                  resetToken,
                  password,
                  confirmPassword,
                });
                navigate(
                  `/login?reset=1&email=${encodeURIComponent(email.trim())}`,
                  { replace: true },
                );
              } catch (err) {
                setError(
                  axios.isAxiosError(err)
                    ? getAuthErrorMessage(err, "Could not reset password.")
                    : "Unable to connect to server.",
                );
              } finally {
                setIsLoading(false);
              }
            }}
          >
            {isLoading ? "Saving…" : "Update password"}
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
        <Link to="/login" className="dp-auth-link">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
