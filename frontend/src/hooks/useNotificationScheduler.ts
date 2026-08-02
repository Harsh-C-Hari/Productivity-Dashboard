import { useEffect, useRef } from "react";
import { useTasks } from "./useTasks";
import { useNotifications } from "@/context/NotificationContext";

const STORAGE_KEY = "prod-dashboard:notified-task-events";
const CHECK_INTERVAL_MS = 60_000; // check once a minute
const WARNING_WINDOW_MINUTES = 60; // alert once a task is within an hour of its deadline

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
    // localStorage may be unavailable (private browsing); notifications
    // will simply re-fire more often in that case, which is harmless.
  }
}

/**
 * Polls active tasks client-side and fires a browser notification:
 *  - once when a task enters its final hour before deadline ("soon")
 *  - once when a task first becomes overdue ("overdue")
 * A localStorage log prevents duplicate pings for the same task+event
 * across polling ticks and page reloads.
 */
export function useNotificationScheduler() {
  const { data: tasks } = useTasks();
  const { notify, permission } = useNotifications();
  const logRef = useRef<NotifiedLog>(loadLog());

  useEffect(() => {
    if (permission !== "granted" || !tasks) return;

    const check = () => {
      const now = Date.now();
      let changed = false;

      for (const task of tasks) {
        if (task.status === "done" || !task.deadline) continue;
        const deadlineMs = new Date(task.deadline).getTime();
        const minutesLeft = (deadlineMs - now) / 1000 / 60;

        if (minutesLeft <= 0) {
          const key = `${task.id}:overdue`;
          if (!logRef.current[key]) {
            notify("Task overdue", `"${task.title}" has passed its deadline.`);
            logRef.current[key] = true;
            changed = true;
          }
        } else if (minutesLeft <= WARNING_WINDOW_MINUTES) {
          const key = `${task.id}:soon`;
          if (!logRef.current[key]) {
            notify(
              "Deadline approaching",
              `"${task.title}" is due in about ${Math.round(minutesLeft)} min.`
            );
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
  }, [tasks, permission, notify]);
}
