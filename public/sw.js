/**
 * Service Worker for Special Risk Allowance Workflow
 *
 * Handles:
 * - Web Push notifications (background delivery)
 * - Optional offline caching (not implemented here)
 *
 * This file must be placed at /public/sw.js so it can be registered
 * at the root scope ("/").
 */

// Activate immediately — don't wait for old tabs to close.
// Critical for dev and for ensuring push events are received.
self.addEventListener("install", () => {
  console.log("[SW] Installing…");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating…");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("[SW] Push event received");

  if (!event.data) {
    console.warn("[SW] Push event has no data");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "การแจ้งเตือนใหม่", body: event.data.text() };
  }

  const title = payload.title ?? "การแจ้งเตือนใหม่";
  const options = {
    body: payload.body ?? "",
    icon: "/logo/pea_logo_big.png",
    badge: "/logo/pea_logo_big.png",
    tag: payload.id ?? "notification",
    data: { link: payload.link ?? "/" },
    requireInteraction: false,
  };

  console.log("[SW] Showing notification:", title);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification.data?.link ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if the app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if (link !== "/") {
              client.navigate(link);
            }
            return;
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(link);
        }
      }),
  );
});
