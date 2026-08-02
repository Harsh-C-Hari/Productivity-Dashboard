import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: "text-urgency-low border-urgency-low/30",
  error: "text-urgency-critical border-urgency-critical/30",
  warning: "text-urgency-high border-urgency-high/30",
  info: "text-secondary border-secondary/30",
};

export function Toaster() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "glass-panel rounded-xl px-4 py-3 flex items-start gap-3 shadow-glass",
                COLORS[t.variant]
              )}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground flex-1">{t.message}</p>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
