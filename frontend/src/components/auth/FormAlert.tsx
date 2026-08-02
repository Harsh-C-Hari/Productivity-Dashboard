import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small inline banner for form-level errors/success messages -- the
 * text-field-level styling (invalid border, etc.) stays on each field;
 * this is for messages that apply to the whole form (e.g. "Incorrect
 * password", "Check your email for a reset link"). */
export function FormAlert({ variant, children }: { variant: "error" | "success"; children: React.ReactNode }) {
  const Icon = variant === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm",
        variant === "error"
          ? "border-urgency-critical/30 bg-urgency-critical/10 text-urgency-critical"
          : "border-urgency-low/30 bg-urgency-low/10 text-urgency-low"
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
