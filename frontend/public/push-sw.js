/*
 * Web Push handlers for the generated Workbox service worker, loaded via
 * importScripts() (see workbox.importScripts in vite.config.ts -- the
 * workbox-build option exists exactly for "add a push listener without
 * switching away from generateSW").
 *
 * Runs in service-worker global scope: plain script, no imports, no
 * bundling. The backend dispatcher (app/routers/push.py) sends JSON of
 * the shape { title, body, url }; `url` is the in-app route a tap on the
 * notification should open (e.g. "/tasks", "/ai-workspace").
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // Not JSON -- still show something rather than dropping the push
    // silently (Chrome requires showing a notification per push).
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Productivity Dashboard";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Exact match first: an already-open dashboard at that route just
      // needs focus.
      for (const client of clientList) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      // Otherwise reuse any open window and navigate it if we can,
      // falling back to opening fresh.
      if (clientList.length > 0 && "focus" in clientList[0]) {
        clientList[0].focus();
        if ("navigate" in clientList[0]) return clientList[0].navigate(target);
        return undefined;
      }
      return self.clients.openWindow(target);
    })()
  );
});
