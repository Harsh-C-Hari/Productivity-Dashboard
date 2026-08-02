import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

/** Shared shell for every standalone identity page (login, register,
 * forgot/reset password, verify email) -- the same dark glassmorphism
 * card, centered, that the rest of the app already uses (see
 * components/ui/card.tsx's `glass-card` / dialog.tsx's `glass-panel`),
 * just full-page instead of inside AppLayout's sidebar/topbar chrome
 * (these pages render outside <AppLayout />, see App.tsx). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-base-950 px-4 py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-aurora opacity-[0.08] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md"
      >
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-4.5 w-4.5 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="font-display font-semibold text-sm">Prod Dashboard</span>
        </Link>

        <div className="glass-panel rounded-2xl p-6 sm:p-7">
          <div className="mb-6 text-center">
            <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
      </motion.div>
    </div>
  );
}
