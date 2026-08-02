import { ShieldAlert, ShieldX, TimerOff, Link2Off, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export type AuthErrorKind = "unauthorized" | "forbidden" | "expired" | "invalid_token" | "server_unavailable";

const COPY: Record<AuthErrorKind, { icon: typeof ShieldAlert; title: string; body: string }> = {
  unauthorized: {
    icon: ShieldAlert,
    title: "You need to sign in",
    body: "This page requires an account. Sign in to continue.",
  },
  forbidden: {
    icon: ShieldX,
    title: "You don't have access",
    body: "Your account doesn't have permission to view this.",
  },
  expired: {
    icon: TimerOff,
    title: "Your session expired",
    body: "For your security, you've been signed out. Sign back in to pick up where you left off.",
  },
  invalid_token: {
    icon: Link2Off,
    title: "This link is invalid or has expired",
    body: "The link you used may be outdated or has already been used. Request a new one below.",
  },
  server_unavailable: {
    icon: ServerCrash,
    title: "Can't reach the server",
    body: "The backend isn't responding right now. Check your connection and try again in a moment.",
  },
};

/** Shared visual for the auth-related failure states listed in the
 * task brief (401 / 403 / expired session / invalid token / server
 * unavailable) -- one component, one look, reused wherever a page
 * needs to show one of these instead of a blank screen. */
export function AuthErrorState({
  kind,
  onRetry,
  action,
}: {
  kind: AuthErrorKind;
  onRetry?: () => void;
  action?: { label: string; to: string };
}) {
  const { icon: Icon, title, body } = COPY[kind];

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-urgency-critical/10 text-urgency-critical">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action ? (
          <Button asChild>
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : (
          (kind === "unauthorized" || kind === "expired") && (
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}
