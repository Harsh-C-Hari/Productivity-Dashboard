import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter, passwordMeetsRequirements } from "@/components/auth/PasswordStrengthMeter";
import { FormAlert } from "@/components/auth/FormAlert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

// Mirrors RegisterRequest field limits in backend/app/schemas.py.
const USERNAME_MAX = 50;
const DISPLAY_NAME_MAX = 150;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const canSubmit =
    username.trim().length > 0 &&
    email.trim().length > 2 &&
    passwordMeetsRequirements(password) &&
    password === confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      navigate("/", { replace: true });
    } catch (err) {
      // The backend distinguishes "Username already taken" vs "Email
      // already registered" (both 409s) -- surfaced verbatim so the
      // person knows exactly which field to change.
      setError(err instanceof Error ? err.message : "Couldn't create your account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your personal productivity dashboard"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <FormAlert variant="error">{error}</FormAlert>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            maxLength={USERNAME_MAX}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jane_doe"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            autoComplete="name"
            maxLength={DISPLAY_NAME_MAX}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe (optional -- defaults to your username)"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm_password">Confirm password</Label>
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {!passwordsMatch && <p className="text-xs text-urgency-critical">Passwords don't match</p>}
        </div>

        <Button type="submit" size="lg" disabled={submitting || !canSubmit} className="mt-1 gap-2">
          {submitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
