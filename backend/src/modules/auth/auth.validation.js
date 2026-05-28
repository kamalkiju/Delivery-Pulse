// ─────────────────────────────────────────────────────────────────────────────
// auth.validation.js — check user input BEFORE hitting the database
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_NUMBER_REGEX = /\d/;

export function validateLogin({ email, password } = {}) {
  const errors = [];
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const passwordValue = typeof password === "string" ? password : "";

  if (!trimmedEmail) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.push("Email must be a valid email address");
  }

  if (!passwordValue) {
    errors.push("Password is required");
  } else if (passwordValue.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  return errors;
}

export function validateRegister({
  name,
  email,
  password,
  orgName,
} = {}) {
  const errors = [];
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const passwordValue = typeof password === "string" ? password : "";
  const trimmedOrgName = typeof orgName === "string" ? orgName.trim() : "";

  if (!trimmedName) {
    errors.push("Name is required");
  } else if (trimmedName.length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  if (!trimmedEmail) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.push("Email must be a valid email address");
  }

  if (!passwordValue) {
    errors.push("Password is required");
  } else {
    if (passwordValue.length < 8) {
      errors.push("Password must be at least 8 characters");
    }
    if (!HAS_NUMBER_REGEX.test(passwordValue)) {
      errors.push("Password must contain at least one number");
    }
  }

  if (!trimmedOrgName) {
    errors.push("Organisation name is required");
  }

  return errors;
}

export function validateSignupEmail({ email } = {}) {
  const errors = [];
  const trimmedEmail = typeof email === "string" ? email.trim() : "";

  if (!trimmedEmail) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.push("Email must be a valid email address");
  }

  return errors;
}

export function validateVerifyEmailCode({ email, code } = {}) {
  const errors = [...validateSignupEmail({ email })];
  const codeValue = typeof code === "string" ? code.trim() : "";

  if (!codeValue) {
    errors.push("Verification code is required");
  } else if (!/^\d{6}$/.test(codeValue)) {
    errors.push("Verification code must be 6 digits");
  }

  return errors;
}

export function validateResetPassword({ password, confirmPassword } = {}) {
  const errors = [];
  const passwordValue = typeof password === "string" ? password : "";
  const confirmValue =
    typeof confirmPassword === "string" ? confirmPassword : "";

  if (!passwordValue) {
    errors.push("Password is required");
  } else {
    if (passwordValue.length < 8) {
      errors.push("Password must be at least 8 characters");
    }
    if (!HAS_NUMBER_REGEX.test(passwordValue)) {
      errors.push("Password must contain at least one number");
    }
  }

  if (!confirmValue) {
    errors.push("Please confirm your password");
  } else if (passwordValue !== confirmValue) {
    errors.push("Passwords do not match");
  }

  return errors;
}

export function validateSetPassword({
  password,
  confirmPassword,
  name,
  orgName,
} = {}) {
  const errors = [...validateResetPassword({ password, confirmPassword })];
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedOrgName = typeof orgName === "string" ? orgName.trim() : "";

  if (!trimmedName) {
    errors.push("Name is required");
  } else if (trimmedName.length < 2) {
    errors.push("Name must be at least 2 characters");
  }

  if (!trimmedOrgName) {
    errors.push("Organisation name is required");
  }

  return errors;
}
