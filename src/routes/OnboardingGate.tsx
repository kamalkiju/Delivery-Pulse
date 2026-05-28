import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../api/auth.api";
import { isOnboardingComplete, markOnboardingComplete } from "../utils/onboarding";

/** Blocks dashboard until onboarding is finished */
export function RequireOnboardingComplete({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        const done =
          user.onboardingCompleted === true || isOnboardingComplete(user.id);
        if (done) {
          markOnboardingComplete(user.id);
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
        }
      })
      .catch(() => setNeedsOnboarding(false))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Only allow onboarding when not yet complete */
export function OnboardingOnly({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        const done =
          user.onboardingCompleted === true || isOnboardingComplete(user.id);
        setComplete(done);
      })
      .catch(() => setComplete(false))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (complete) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
