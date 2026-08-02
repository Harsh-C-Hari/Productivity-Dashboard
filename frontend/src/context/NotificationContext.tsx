import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getPermission,
  requestNotificationPermission,
  fireNotification,
} from "@/lib/notifications";

export interface Toast {
  id: string;
  message: string;
  variant: "success" | "error" | "info" | "warning";
}

interface NotificationContextValue {
  permission: NotificationPermission | "unsupported";
  requestPermission: () => Promise<void>;
  notify: (title: string, body?: string) => void; // browser notification
  toast: (message: string, variant?: Toast["variant"]) => void; // in-app toast
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    getPermission()
  );
  const [toasts, setToasts] = useState<Toast[]>([]);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: Toast["variant"] = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast]
  );

  const notify = useCallback((title: string, body?: string) => {
    fireNotification(title, { body });
  }, []);

  // Keep permission state fresh if the user changes it via browser chrome.
  useEffect(() => {
    setPermission(getPermission());
  }, []);

  return (
    <NotificationContext.Provider
      value={{ permission, requestPermission, notify, toast, toasts, dismissToast }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
