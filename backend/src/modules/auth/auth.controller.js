// ─────────────────────────────────────────────────────────────────────────────
// auth.controller.js — HTTP layer: reads req, calls service, sends res
//
// Controllers sit between Express routes and auth.service.js.
// They translate browser requests into service calls and pick the right
// HTTP status code for each outcome.
//
// HTTP status codes (quick reference for designers):
//   200 OK        — request succeeded (login, getMe, logout)
//   201 Created   — new resource created (register = new user + org)
//   400 Bad Request — validation failed (missing email, weak password, etc.)
//   401 Unauthorized — wrong password (identity known, proof failed)
//   404 Not Found — user/email does not exist
//   409 Conflict  — email already taken (duplicate signup)
//   500 Internal Server Error — unexpected bug on the server
// ─────────────────────────────────────────────────────────────────────────────

import * as authService from "./auth.service.js";
import {
  validateLogin,
  validateRegister,
  validateSignupEmail,
  validateVerifyEmailCode,
  validateSetPassword,
  validateResetPassword,
} from "./auth.validation.js";

function validationResponse(res, errors) {
  return res.status(400).json({ success: false, errors });
}

function serviceErrorResponse(res, error, fallbackStatus = 500) {
  const status = error.statusCode ?? fallbackStatus;
  return res.status(status).json({
    success: false,
    message: error.message ?? "Server error",
  });
}

// ── loginController ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Frontend: LoginPage.tsx → loginUser() in src/api/auth.api.ts
 * Body: { email, password }
 */
export async function loginController(req, res) {
  const { email, password } = req.body ?? {};

  // 400 = client sent bad input — show all messages in the UI (e.g. under each field)
  const errors = validateLogin({ email, password });
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  try {
    const result = await authService.login(email, password);

    // 200 = success — LoginPage saves token + user, then redirects to dashboard/onboarding
    return res.status(200).json({
      success: true,
      token: result.token,
      user: result.user,
      needsOnboarding: result.needsOnboarding,
      message: "Login successful",
    });
  } catch (error) {
    const message = error.message ?? "Server error";

    // 404 = no account with this email (service: "User not found with this email")
    if (message.includes("User not found")) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    // 401 = email exists but password wrong
    if (message === "Invalid password") {
      return res.status(401).json({
        success: false,
        message,
      });
    }

    // 500 = something broke in code or database — not the user's fault
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// ── registerController ────────────────────────────────────────────────────────

/**
 * POST /api/auth/register  (alias: POST /api/auth/signup)
 *
 * Frontend: SignupPage.tsx → signupUser() in src/api/auth.api.ts
 * Body: { name, email, password, orgName, role? } — also accepts organisationName as orgName
 */
export async function registerController(req, res) {
  const {
    name,
    email,
    password,
    orgName,
    organisationName,
    role,
  } = req.body ?? {};

  const resolvedOrgName = orgName ?? organisationName;

  const errors = validateRegister({
    name,
    email,
    password,
    orgName: resolvedOrgName,
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  try {
    const result = await authService.register(
      name,
      email,
      password,
      resolvedOrgName,
      role,
    );

    // 201 Created — new user + organisation were saved in MongoDB
    return res.status(201).json({
      success: true,
      token: result.token,
      user: result.user,
      needsOnboarding: result.needsOnboarding,
      message: "Account created successfully",
    });
  } catch (error) {
    const message = error.message ?? "Server error";

    // 409 Conflict — email is already in the database
    if (message === "Email already registered") {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}

// ── getMeController ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 *
 * Frontend: OnboardingGate.tsx, getCurrentUser() in src/api/auth.api.ts
 * Requires: Authorization: Bearer <token> (authMiddleware sets req.user)
 */
export async function getMeController(req, res) {
  const userId = req.user?.userId ?? req.user?.id;

  try {
    const user = await authService.getMe(userId);

    // 200 OK — user profile without password (OnboardingGate, profile header)
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    const message = error.message ?? "User not found";

    // 404 — token referred to a user that was deleted or never existed
    return res.status(404).json({
      success: false,
      message: message.includes("User not found") ? message : "User not found",
    });
  }
}

// ── Multi-step signup controllers ───────────────────────────────────────────

/** POST /api/auth/signup/start — SignupPage step 1 */
export async function signupStartController(req, res) {
  const { email } = req.body ?? {};
  const errors = validateSignupEmail({ email });
  if (errors.length > 0) {
    return validationResponse(res, errors);
  }

  try {
    const result = await authService.signupStart(email);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
}

/** POST /api/auth/signup/verify-email — SignupPage step 2 */
export async function signupVerifyEmailController(req, res) {
  const { email, code } = req.body ?? {};
  const errors = validateVerifyEmailCode({ email, code });
  if (errors.length > 0) {
    return validationResponse(res, errors);
  }

  try {
    const result = await authService.signupVerifyEmail(email, code);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
}

/** POST /api/auth/signup/set-password — SignupPage step 3 → redirect to login */
export async function signupSetPasswordController(req, res) {
  const { signupToken, password, confirmPassword, name, orgName } = req.body ?? {};
  const errors = validateSetPassword({
    password,
    confirmPassword,
    name,
    orgName,
  });
  if (errors.length > 0) {
    return validationResponse(res, errors);
  }

  try {
    const result = await authService.signupSetPassword({
      signupToken,
      password,
      name,
      orgName,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
}

// ── Forgot password ─────────────────────────────────────────────────────────

export async function forgotPasswordStartController(req, res) {
  const { email } = req.body ?? {};
  const errors = validateSignupEmail({ email });
  if (errors.length > 0) {
    return validationResponse(res, errors);
  }

  try {
    const result = await authService.forgotPasswordStart(email);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
}

export async function forgotPasswordVerifyController(req, res) {
  const { email, code } = req.body ?? {};
  const errors = validateVerifyEmailCode({ email, code });
  if (errors.length > 0) {
    return validationResponse(res, errors);
  }

  try {
    const result = await authService.forgotPasswordVerify(email, code);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
}

export async function forgotPasswordResetController(req, res) {
  const { resetToken, password, confirmPassword } = req.body ?? {};
  const errors = validateResetPassword({ password, confirmPassword });
  if (errors.length > 0) {
    return validationResponse(res, errors);
  }

  try {
    const result = await authService.forgotPasswordReset({
      resetToken,
      password,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return serviceErrorResponse(res, error);
  }
}

// ── logoutController ──────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 *
 * Frontend: Sidebar.tsx → logoutUser() in src/api/auth.api.ts
 *
 * JWT logout is stateless: the server does not store sessions.
 * Real logout = frontend removes the token from localStorage.
 * This endpoint only acknowledges the action (200 OK).
 */
export function logoutController(_req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

// ── Onboarding (used by auth.routes.js) ───────────────────────────────────────

/**
 * POST /api/auth/onboarding/complete
 *
 * Frontend: OnboardingPage.tsx → completeOnboardingApi() in auth.api.ts
 */
export async function completeOnboarding(req, res) {
  const userId = req.user?.userId ?? req.user?.id;

  try {
    const user = await authService.completeOnboarding(userId);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message ?? "User not found",
    });
  }
}
