import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter, passwordMeetsRequirements } from "@/components/auth/PasswordStrengthMeter";
import { FormAlert } from "@/components/auth/FormAlert";
import { AuthErrorState } from "@/components/auth/AuthErrorState";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = passwordMeetsRequirements(password) && password === confirmPassword;

  if (!token) {
    return (
      <AuthShell title="Reset your password">
        <AuthErrorState kind="invalid_token" action={{ label: "Request a new link", to: "/forgot-password" }} />
      </AuthShell>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      // The backend returns a generic 400 "Invalid or expired password
      // reset token" for both "wrong token" and "expired token" --
      // deliberately vague, same account-enumeration reasoning as the
      // request endpoint (see schemas.PasswordResetRequestOut).
      setError(err instanceof Error ? err.message : "Couldn't reset your password");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Password reset">
        <div className="flex flex-col gap-4">
          <FormAlert variant="success">
            Your password has been reset. Every device you were signed in on has been logged out for
            your security.
          </FormAlert>
          <Button size="lg" onClick={() => navigate("/login", { replace: true })}>
            Sign in with your new password
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <FormAlert variant="error">{error}</FormAlert>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {confirmPassword.length > 0 && confirmPassword !== password && (
            <p className="text-xs text-urgency-critical">Passwords don't match</p>
          )}
        </div>

        <Button type="submit" size="lg" disabled={submitting || !canSubmit} className="mt-1 gap-2">
          {submitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {submitting ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </AuthShell>
  );
}
