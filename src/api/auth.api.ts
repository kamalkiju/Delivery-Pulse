// auth.api.ts — login, logout, and current user (LoginPage + app bootstrap)
import api from "./axios";
import { AUTH_TOKEN_KEY } from "./constants";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  onboardingCompleted?: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  needsOnboarding?: boolean;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  organisationName?: string;
  orgName?: string;
}

interface ApiAuthSuccess {
  success: boolean;
  token: string;
  user: AuthUser;
  needsOnboarding?: boolean;
  message?: string;
}

function toLoginResponse(data: ApiAuthSuccess): LoginResponse {
  return {
    token: data.token,
    user: data.user,
    needsOnboarding: data.needsOnboarding,
  };
}

/** Step 1 — request email verification code */
export async function signupStartEmail(email: string): Promise<{
  email: string;
  message: string;
  devCode?: string;
}> {
  const { data } = await api.post<{
    success: boolean;
    email: string;
    message: string;
    devCode?: string;
  }>("/auth/signup/start", { email });
  return data;
}

/** Step 2 — verify 6-digit code */
export async function signupVerifyEmail(
  email: string,
  code: string,
): Promise<{ email: string; signupToken: string; message: string }> {
  const { data } = await api.post<{
    success: boolean;
    email: string;
    signupToken: string;
    message: string;
  }>("/auth/signup/verify-email", { email, code });
  return data;
}

/** Step 3 — create account; user signs in on LoginPage after */
export async function signupSetPassword(payload: {
  signupToken: string;
  password: string;
  confirmPassword: string;
  name: string;
  orgName: string;
}): Promise<{ email: string; message: string }> {
  const { data } = await api.post<{
    success: boolean;
    email: string;
    message: string;
  }>("/auth/signup/set-password", payload);
  return data;
}

export async function forgotPasswordStart(email: string) {
  const { data } = await api.post<{
    success: boolean;
    email: string;
    message: string;
    devCode?: string;
  }>("/auth/forgot-password/start", { email });
  return data;
}

export async function forgotPasswordVerify(email: string, code: string) {
  const { data } = await api.post<{
    success: boolean;
    email: string;
    resetToken: string;
    message: string;
  }>("/auth/forgot-password/verify", { email, code });
  return data;
}

export async function forgotPasswordReset(payload: {
  resetToken: string;
  password: string;
  confirmPassword: string;
}) {
  const { data } = await api.post<{
    success: boolean;
    email: string;
    message: string;
  }>("/auth/forgot-password/reset", payload);
  return data;
}

/** Legacy one-step register (kept for compatibility) */
export async function signupUser(payload: SignupPayload): Promise<LoginResponse> {
  const { data } = await api.post<ApiAuthSuccess>("/auth/register", {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    orgName: payload.orgName ?? payload.organisationName ?? "",
    role: "admin",
  });
  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  return toLoginResponse(data);
}

/**
 * POST /auth/login — body: { email, password }
 * Used by: LoginPage when user clicks Sign In
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<ApiAuthSuccess>("/auth/login", {
    email,
    password,
  });

  localStorage.setItem(AUTH_TOKEN_KEY, data.token);

  return toLoginResponse(data);
}

/**
 * Clears session and sends user to login screen.
 * Used by: Sidebar logout control
 */
export function logoutUser(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.location.assign("/login");
}

/**
 * GET /auth/me — no body; uses Bearer token from interceptor
 * Used by: OnboardingGate, optional app bootstrap
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<{ success: boolean; user: AuthUser } | AuthUser>(
    "/auth/me",
  );
  return "user" in data && data.user ? data.user : (data as AuthUser);
}

/** POST /auth/onboarding/complete — mark wizard done, then go to dashboard */
export async function completeOnboardingApi(): Promise<AuthUser> {
  const { data } = await api.post<AuthUser | { success: boolean; user: AuthUser }>(
    "/auth/onboarding/complete",
  );
  return "user" in data && data.user ? data.user : (data as AuthUser);
}

/** Extract user-facing error from API validation or auth errors */
export function getAuthErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const axiosErr = err as {
      response?: { data?: { message?: string; errors?: string[] } };
    };
    const body = axiosErr.response?.data;
    if (body?.errors?.length) {
      return body.errors.join(" ");
    }
    if (body?.message) {
      return body.message;
    }
  }
  return fallback;
}
