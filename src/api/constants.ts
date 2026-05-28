/** Shared key for JWT/session token in localStorage — used by axios, ProtectedRoute, and auth.api */
export const AUTH_TOKEN_KEY = "auth-token";

/** Per-user flag: onboarding wizard completed (localStorage suffix = user id) */
export const ONBOARDING_KEY_PREFIX = "onboarding-complete";
