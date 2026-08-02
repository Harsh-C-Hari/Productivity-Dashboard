import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors backend/app/security.py's `_PASSWORD_RULES` exactly (the
// four rules actually enforced by /api/auth/register and
// /change-password) plus two purely-advisory extras (uppercase,
// symbol) so the meter isn't just a binary pass/fail -- the extras
// never block submission, only the four backend rules do.
const REQUIRED_RULES = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[a-zA-Z]/.test(p), label: "At least one letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "At least one number" },
];
const ADVISORY_RULES = [
  { test: (p: string) => /[A-Z]/.test(p) && /[a-z]/.test(p), label: "Mix of upper & lowercase (recommended)" },
  { test: (p: string) => /[^a-zA-Z0-9]/.test(p), label: "A symbol (recommended)" },
];

export function passwordMeetsRequirements(password: string): boolean {
  return REQUIRED_RULES.every((r) => r.test(password)) && password.length <= 128;
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const allRules = [...REQUIRED_RULES, ...ADVISORY_RULES];
  const passedCount = allRules.filter((r) => r.test(password)).length;
  const strength = password.length === 0 ? 0 : passedCount / allRules.length;

  const barColor =
    strength >= 0.8 ? "bg-urgency-low" : strength >= 0.5 ? "bg-urgency-medium" : "bg-urgency-critical";

  if (password.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-1.5 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full bg-white/10 transition-colors",
              strength * 4 > i && barColor
            )}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {REQUIRED_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className="flex items-center gap-1.5 text-xs">
              {ok ? (
                <Check className="h-3 w-3 text-urgency-low" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/50" />
              )}
              <span className={ok ? "text-muted-foreground" : "text-muted-foreground/70"}>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
