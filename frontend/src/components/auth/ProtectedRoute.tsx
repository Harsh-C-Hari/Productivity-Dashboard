import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/** Wraps any route element that requires a signed-in user. While the
 * session is being restored from a persisted refresh token (see
 * AuthContext's mount effect) it renders nothing but a loading shell,
 * rather than flashing the login page and immediately redirecting away
 * from it once restore succeeds. Unauthenticated users are sent to
 * /login with the page they wanted attached in location state, so
 * Login can send them back afterward. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

/** Inverse guard for the auth pages themselves (login/register/etc.) --
 * an already-signed-in user shouldn't see a login form, they should be
 * bounced straight to the dashboard. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
