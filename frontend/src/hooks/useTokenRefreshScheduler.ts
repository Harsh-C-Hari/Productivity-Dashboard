import { useEffect, useRef } from "react";
import { useAIAccounts } from "./useAIAccounts";
import { useNotifications } from "@/context/NotificationContext";

const STORAGE_KEY = "ai-workspace:notified-token-events";
const CHECK_INTERVAL_MS = 60_000; // once a minute, same cadence as useNotificationScheduler
const WARNING_WINDOW_MINUTES = 15; // "expiring soon" heads-up before the user's own reminder time

type NotifiedLog = Record<string, true>;

function loadLog(): NotifiedLog {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveLog(log: NotifiedLog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Private browsing / storage disabled -- harmless, just re-fires more often.
  }
}

/**
 * Polls the *user-set* token refresh reminders (now persisted on each
 * `AIAccount.token_refresh_reminder_at`, synced across every device --
 * see models.py / TokenRefreshCountdown.tsx) and fires a browser
 * notification:
 *  - once when a reminder enters its final 15 minutes ("expiring soon")
 *  - once when a reminder's time is reached ("token refreshed")
 *
 * Mirrors useNotificationScheduler.ts's task-deadline pattern exactly,
 * reusing the same NotificationContext rather than a parallel system.
 * These are reminders the user set themselves, not a real provider-
 * side usage event, so the copy below is deliberately framed as "your
 * reminder".
 */
export function useTokenRefreshScheduler() {
  const { data: accounts } = useAIAccounts();
  const { notify, permission } = useNotifications();
  const logRef = useRef<NotifiedLog>(loadLog());

  useEffect(() => {
    if (permission !== "granted" || !accounts) return;

    const check = () => {
      const now = Date.now();
      let changed = false;

      for (const account of accounts) {
        const iso = account.token_refresh_reminder_at;
        if (!iso) continue;
        const targetMs = new Date(iso).getTime();
        const minutesLeft = (targetMs - now) / 1000 / 60;

        if (minutesLeft <= 0) {
          const key = `${account.id}:${iso}:reached`;
          if (!logRef.current[key]) {
            notify("Token refresh reminder", `Your reminder for "${account.name}" has been reached.`);
            logRef.current[key] = true;
            changed = true;
          }
        } else if (minutesLeft <= WARNING_WINDOW_MINUTES) {
          const key = `${account.id}:${iso}:soon`;
          if (!logRef.current[key]) {
            notify("Token refresh expiring soon", `"${account.name}" reminder in about ${Math.round(minutesLeft)} min.`);
            logRef.current[key] = true;
            changed = true;
          }
        }
      }

      if (changed) saveLog(logRef.current);
    };

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [accounts, permission, notify]);
}
