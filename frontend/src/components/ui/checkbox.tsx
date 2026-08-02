import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Native <input type="checkbox"> under the hood (full keyboard/label
 * semantics for free) with the app's glass styling layered on top via
 * the peer + peer-checked pattern already used elsewhere in this app. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onChange, className, ...props }, ref) => (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center mt-0.5">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("peer absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded border border-white/20 bg-base-900/60", "checked:border-primary checked:bg-primary", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50", className)}
        {...props}
      />
      <Check className="pointer-events-none h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
    </span>
  )
);
Checkbox.displayName = "Checkbox";
