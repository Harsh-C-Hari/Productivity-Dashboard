/**
 * Thin wrapper around the browser Notification API. Kept defensive
 * because Notification support/permission varies across mobile browsers
 * and in-app PWA contexts.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export function fireNotification(title: string, options?: NotificationOptions) {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      ...options,
    });
  } catch {
    // Some mobile browsers throw when constructing Notification directly
    // outside a service worker context; fail silently rather than crash the app.
  }
}
