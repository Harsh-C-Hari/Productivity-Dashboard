import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormAlert } from "@/components/auth/FormAlert";
import { AuthErrorState } from "@/components/auth/AuthErrorState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { User } from "@/types/auth";

/** Handles two entry points on one route:
 *  - `/verify-email?token=...` -- the link from the (unsent, dev-only)
 *    verification email; confirms the token. Works whether or not the
 *    visitor is currently signed in, matching
 *    routers/auth.py's `confirm_email_verification` (no auth required).
 *  - `/verify-email` with no token -- a signed-in user checking their
 *    status / requesting a (re)send. Requires auth, since
 *    `request_email_verification` needs to know *whose* email.
 *
 * `schemas.UserOut` now exposes `email_verified`, so `StatusView` shows
 * a real "Verified" / "Unverified" state instead of only offering to
 * (re)send a link. */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { status, user, updateUser } = useAuth();

  if (token) return <ConfirmView token={token} onVerified={updateUser} />;
  return <StatusView authStatus={status} email={user?.email} emailVerified={user?.email_verified} />;
}

function ConfirmView({ token, onVerified }: { token: string; onVerified: (patch: Partial<User>) => void }) {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const updated = await api.confirmEmailVerification(token);
        if (!cancelled) {
          setState("success");
          onVerified(updated);
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setMessage(err instanceof Error ? err.message : "Couldn't verify your email");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <AuthShell title="Verifying your email">
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Just a moment…</p>
        </div>
      </AuthShell>
    );
  }

  if (state === "error") {
    return (
      <AuthShell title="Email verification">
        <AuthErrorState kind="invalid_token" />
        <p className="mt-2 text-center text-xs text-muted-foreground">{message}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Email verified">
      <div className="flex flex-col gap-4">
        <FormAlert variant="success">Your email address has been verified.</FormAlert>
        <Button asChild size="lg">
          <Link to="/">Go to dashboard</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

function StatusView({
  authStatus,
  email,
  emailVerified,
}: {
  authStatus: string;
  email?: string;
  emailVerified?: boolean;
}) {
  const [requesting, setRequesting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  if (authStatus === "loading") {
    return (
      <AuthShell title="Email verification">
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AuthShell>
    );
  }

  if (authStatus !== "authenticated") {
    return (
      <AuthShell title="Email verification">
        <AuthErrorState kind="unauthorized" />
      </AuthShell>
    );
  }

  if (emailVerified) {
    return (
      <AuthShell title="Email verification">
        <div className="flex flex-col gap-4">
          <FormAlert variant="success">Your email address is verified.</FormAlert>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  async function handleResend() {
    setRequesting(true);
    setError(null);
    try {
      const res = await api.requestEmailVerification();
      setSent(true);
      setDebugToken(res.debug_verification_token ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a verification link");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <AuthShell
      title="Verify your email"
      subtitle={email ? `We'll send a verification link to ${email}` : undefined}
    >
      <div className="flex flex-col gap-4">
        {error && <FormAlert variant="error">{error}</FormAlert>}
        {sent && (
          <FormAlert variant="success">
            {debugToken ? "A verification link has been prepared." : "Check your email for a verification link."}
          </FormAlert>
        )}
        {debugToken && (
          <div className="rounded-xl border border-white/10 bg-base-900/60 p-3.5 text-xs">
            <p className="mb-1.5 text-muted-foreground">Dev mode (no mail sender configured):</p>
            <Link
              to={`/verify-email?token=${encodeURIComponent(debugToken)}`}
              className="break-all font-mono text-primary hover:underline"
            >
              /verify-email?token={debugToken}
            </Link>
          </div>
        )}

        <Button size="lg" onClick={handleResend} disabled={requesting} className="gap-2">
          {requesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailCheck className="h-4 w-4" />
          )}
          {requesting ? "Sending…" : sent ? "Send another link" : "Send verification link"}
        </Button>

        <Button asChild variant="ghost" size="sm">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
