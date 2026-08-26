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
  // This device's push endpoint URL when subscribed -- Settings uses it to
  // ask the backend whether the server still holds this row
  // ("subscribed" above only reflects the browser's local record).
  endpoint: string | null;
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
  if (!isPushSupported())
    return { supported: false, subscribed: false, endpoint: null, permission: getPermission() };

  try {
    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return {
      supported: true,
      subscribed: !!sub,
      endpoint: sub?.endpoint ?? null,
      permission: Notification.permission,
    };
  } catch {
    // Some browsers throw on pushManager access when permission was
    // permanently dismissed; degrade to an honest "not subscribed".
    return { supported: true, subscribed: false, endpoint: null, permission: Notification.permission };
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
 * True when this subscription was minted under the same VAPID public key
 * the app is configured with right now. A stale one can exist if the
 * deployed key ever changed: the browser happily hands back its old
 * PushSubscription, but the push service rejects every send signed with
 * the current backend key, so such a subscription must be replaced --
 * re-POSTing it would just register something undeliverable.
 */
function matchesConfiguredKey(sub: PushSubscription): boolean {
  try {
    const optionsKey = sub.options?.applicationServerKey;
    if (!optionsKey) return false;
    // Runtime-safe either way: an ArrayBuffer is read directly, a typed
    // array view is copied element-wise.
    const actual = new Uint8Array(optionsKey as ArrayBuffer);
    const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    return actual.length === expected.length && expected.every((byte, i) => actual[i] === byte);
  } catch {
    return false;
  }
}

/**
 * Ask for notification permission if needed, subscribe this device via
 * PushManager, and register the subscription with the backend so
 * /api/push/dispatch includes it. Idempotent: an existing subscription is
 * re-POSTed (the backend upserts by endpoint) -- unless it was minted
 * under a different VAPID key, in which case it's replaced first. Throws
 * so the caller can surface a toast; every failure leaves prior state
 * untouched.
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
  if (sub && !matchesConfiguredKey(sub)) {
    // Stale key pair -- see matchesConfiguredKey. Start clean rather than
    // re-registering an endpoint no push will ever reach.
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
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
