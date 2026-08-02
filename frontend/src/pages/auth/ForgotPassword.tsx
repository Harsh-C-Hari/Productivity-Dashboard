import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormAlert } from "@/components/auth/FormAlert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Only ever populated when the backend has AUTH_DEBUG_EXPOSE_TOKENS=true
  // (local/dev, no mail server configured) -- see schemas.PasswordResetRequestOut.
  const [debugToken, setDebugToken] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.requestPasswordReset(email.trim());
      setSent(true);
      setDebugToken(res.debug_reset_token ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll prepare a reset link"
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <FormAlert variant="success">
            If that email is registered, a password reset link has been prepared.
          </FormAlert>
          {debugToken && (
            <div className="rounded-xl border border-white/10 bg-base-900/60 p-3.5 text-xs">
              <p className="mb-1.5 text-muted-foreground">
                Dev mode (no mail sender configured) -- use this link directly:
              </p>
              <Link
                to={`/reset-password?token=${encodeURIComponent(debugToken)}`}
                className="break-all font-mono text-primary hover:underline"
              >
                /reset-password?token={debugToken}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <FormAlert variant="error">{error}</FormAlert>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <Button type="submit" size="lg" disabled={submitting} className="mt-1 gap-2">
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
