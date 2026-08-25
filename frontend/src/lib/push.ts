/**
 * Web Push subscription helpers: lets the installed PWA receive system
 * notifications even with every browser/app closed. Complements (never
 * replaces) lib/notifications.ts's while-the-tab-is-open alerts -- both
 * fire the same deadline/token events, one locally, one via the
 * backend's /api/push/dispatch.
 *
 * Kept defensive like notifications.ts because Push support varies:
 * Firefox Android has no Push API, iOS Safari only allows it for
 * home-screen-installed apps on >= 16.4, and the service worker this
 * depends on only exists in production builds (vite-plugin-pwa's
 * devOptions are disabled), so everything here no-ops gracefully in dev.
 */
import { api } from "@/lib/api";
import type { PushSubscriptionInput } from "@/types";

// Same key pair the backend signs pushes with (backend env VAPID_PUBLIC_KEY).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

export interface DevicePushState {
  supported: boolean;
  subscribed: boolean;
  permission: NotificationPermission | "unsupported";
}

/**
 * getRegistration() rather than serviceWorker.ready: `ready` resolves only
 * once a SW is active and never rejects, so it would hang forever in dev
 * builds where no service worker is generated at all. Polls briefly because
 * a first production visit races registerSW.js -- getRegistration() answers
 * undefined until that script has run.
 */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg;
    await new Promise((resolve) => window.setTimeout(resolve, 300));
  }
  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getDevicePushState(): Promise<DevicePushState> {
  if (!isPushSupported()) return { supported: false, subscribed: false, permission: getPermission() };

  try {
    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return { supported: true, subscribed: !!sub, permission: Notification.permission };
  } catch {
    // Some browsers throw on pushManager access when permission was
    // permanently dismissed; degrade to an honest "not subscribed".
    return { supported: true, subscribed: false, permission: Notification.permission };
  }
}

function toSubscriptionInput(sub: PushSubscription): PushSubscriptionInput {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription");
  }
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

/**
 * Ask for notification permission if needed, subscribe this device via
 * PushManager, and register the subscription with the backend so
 * /api/push/dispatch includes it. Idempotent: an existing subscription is
 * re-POSTed (the backend upserts by endpoint). Throws so the caller can
 * surface a toast; every failure leaves prior state untouched.
 */
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) throw new Error("Push isn't supported on this device/browser");

  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") throw new Error("Notification permission wasn't granted");
  }

  const reg = await getRegistration();
  if (!reg) throw new Error("App shell still loading — try again in a moment");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // BufferSource cast: under TS >= 5.7's generic typed arrays the bare
      // Uint8Array return widens to ArrayBufferLike, which isn't assignable
      // to applicationServerKey.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  await api.createPushSubscription(toSubscriptionInput(sub));
}

/** Unsubscribe this device both server-side and in the browser itself.
 * Server call is best-effort: a failed DELETE must not leave the local
 * unsubscribe undone (an orphaned row gets pruned by the dispatcher's
 * 404/410 handling anyway). */
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;

  try {
    await api.deletePushSubscription(sub.endpoint);
  } catch {
    // best-effort -- see docstring
  }
  await sub.unsubscribe().catch(() => undefined);
}

function getPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}
