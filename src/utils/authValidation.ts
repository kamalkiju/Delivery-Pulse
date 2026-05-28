/** Client-side auth validation — mirrors backend auth.validation.js */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_NUMBER_REGEX = /\d/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_REGEX.test(trimmed)) return "Email must be a valid email address";
  return null;
}

export function validateVerificationCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return "Verification code is required";
  if (!/^\d{6}$/.test(trimmed)) return "Verification code must be 6 digits";
  return null;
}

export function validatePasswordPair(
  password: string,
  confirmPassword: string,
): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!HAS_NUMBER_REGEX.test(password)) {
    return "Password must contain at least one number";
  }
  if (!confirmPassword) return "Please confirm your password";
  if (password !== confirmPassword) return "Passwords do not match";
  return null;
}

export function validateLoginFields(
  email: string,
  password: string,
): string | null {
  const emailErr = validateEmail(email);
  if (emailErr) return emailErr;
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}
