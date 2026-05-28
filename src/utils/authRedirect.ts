import type { AuthUser } from "../api/auth.api";
import { isOnboardingComplete } from "./onboarding";

/** Where to send the user after login or signup */
export function getPostAuthPath(user: AuthUser, needsOnboarding?: boolean): string {
  const pending =
    needsOnboarding === true ||
    user.onboardingCompleted === false ||
    !isOnboardingComplete(user.id);

  if (pending) {
    return "/onboarding";
  }
  return "/dashboard";
}
