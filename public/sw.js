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

// @ts-nocheck — service worker global scope

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "การแจ้งเตือนใหม่", body: event.data.text() };
  }

  const title = payload.title ?? "การแจ้งเตือนใหม่";
  const options = {
    body: payload.body ?? "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.id ?? "notification",
    data: { link: payload.link ?? "/" },
    requireInteraction: false,
  };

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
