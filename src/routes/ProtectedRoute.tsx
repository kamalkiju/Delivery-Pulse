// ProtectedRoute — gate that only renders child pages when the user is logged in
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AUTH_TOKEN_KEY } from "../api/constants";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Returns true when a non-empty auth token string exists in localStorage.
 * Browsers persist localStorage until cleared — survives refresh.
 */
function hasAuthToken(): boolean {
  const token = localStorage.getItem(AUTH_TOKEN_KEY); // Read stored token (or null if missing)
  return Boolean(token && token.trim().length > 0); // Treat whitespace-only as logged out
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // If token exists, render the protected page the user asked for
  if (hasAuthToken()) {
    return <>{children}</>; // Fragment wraps children without adding extra DOM nodes
  }

  // No token — send user to login; replace=true avoids back-button returning to protected URL
  return <Navigate to="/login" replace />;
}
