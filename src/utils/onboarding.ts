import { ONBOARDING_KEY_PREFIX } from "../api/constants";

export function isOnboardingComplete(userId: string): boolean {
  return localStorage.getItem(`${ONBOARDING_KEY_PREFIX}:${userId}`) === "true";
}

export function markOnboardingComplete(userId: string): void {
  localStorage.setItem(`${ONBOARDING_KEY_PREFIX}:${userId}`, "true");
}

export function clearOnboardingForUser(userId: string): void {
  localStorage.removeItem(`${ONBOARDING_KEY_PREFIX}:${userId}`);
}
