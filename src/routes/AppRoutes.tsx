// AppRoutes — central map of URLs to page components for DeliveryPulse
import { Navigate, Route, Routes } from "react-router-dom"; // Core routing primitives from react-router-dom

import ProtectedRoute from "./ProtectedRoute"; // Wrapper — blocks pages when auth-token is missing

// Page imports — one component per major screen in the app
import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import OnboardingPage from "../pages/onboarding/OnboardingPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import { OnboardingOnly, RequireOnboardingComplete } from "./OnboardingGate";
import SlackMessagesPage from "../pages/slack/SlackMessagesPage";
import ReviewQueuePage from "../pages/review/ReviewQueuePage";
import DocumentsPage from "../pages/documents/DocumentsPage";
import MeetingsPage from "../pages/meetings/MeetingsPage";
import AdoStoriesPage from "../pages/ado/AdoStoriesPage";
import ClientsPage from "../pages/clients/ClientsPage";
import ClientDetailPage from "../pages/clients/ClientDetailPage";
import ReportsPage from "../pages/reports/ReportsPage";
import SettingsPage from "../pages/settings/SettingsPage";
import ProfilePage from "../pages/profile/ProfilePage";
import type { ReactNode } from "react";

function ProtectedApp({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireOnboardingComplete>{children}</RequireOnboardingComplete>
    </ProtectedRoute>
  );
}

export default function AppRoutes() {
  return (
  // Routes picks the first matching Route for the current browser URL
    <Routes>
      {/* ── PUBLIC ROUTES (no login required) ───────────────── */}

      {/* /login — sign-in screen; must stay public so logged-out users can authenticate */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingOnly>
              <OnboardingPage />
            </OnboardingOnly>
          </ProtectedRoute>
        }
      />

      {/* / — root URL; send visitors to the main dashboard path */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* ── PROTECTED ROUTES (require auth-token in localStorage) ── */}
      {/* ProtectedRoute checks localStorage before rendering the page inside */}

      {/* /dashboard — home KPIs and client health overview */}
      <Route
        path="/dashboard"
        element={
          <ProtectedApp>
            <DashboardPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/slack"
        element={
          <ProtectedApp>
            <SlackMessagesPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/review"
        element={
          <ProtectedApp>
            <ReviewQueuePage />
          </ProtectedApp>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedApp>
            <DocumentsPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/meetings"
        element={
          <ProtectedApp>
            <MeetingsPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/ado"
        element={
          <ProtectedApp>
            <AdoStoriesPage />
          </ProtectedApp>
        }
      />

      {/* /clients — list all clients */}
      <Route
        path="/clients"
        element={
          <ProtectedApp>
            <ClientsPage />
          </ProtectedApp>
        }
      />

      {/* /clients/:id — single client health detail; :id is techcorp, startupxyz, etc. */}
      <Route
        path="/clients/:id"
        element={
          <ProtectedApp>
            <ClientDetailPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedApp>
            <ReportsPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedApp>
            <SettingsPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/settings/slack"
        element={
          <ProtectedApp>
            <SettingsPage />
          </ProtectedApp>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedApp>
            <ProfilePage />
          </ProtectedApp>
        }
      />

      {/* ── CATCH-ALL — unknown paths go to dashboard ───────── */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
