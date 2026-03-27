"use client";

/**
 * ServiceWorkerRegistration
 *
 * Mounts once (client only) and:
 * 1. Registers /sw.js as a service worker.
 * 2. Fetches the VAPID public key from the API.
 * 3. Creates (or retrieves) a PushSubscription and saves it to the backend.
 *
 * This component renders nothing visible — it purely handles registration.
 * Place it inside a layout that's rendered when the user is authenticated.
 */

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    async function registerPush() {
      try {
        // 1. Register the service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Wait for the SW to be ready before subscribing
        await navigator.serviceWorker.ready;

        // 2. Check current notification permission — don't prompt, just skip if denied
        if (Notification.permission === "denied") return;

        // 3. Fetch the VAPID public key
        const keyRes = await fetch("/api/notifications/vapid-public-key");
        if (!keyRes.ok) return;
        const { publicKey } = (await keyRes.json()) as { publicKey: string };

        // 4. Subscribe (reuses existing subscription if one already exists)
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
            .buffer as ArrayBuffer,
        });

        const json = subscription.toJSON();
        if (!json.keys?.p256dh || !json.keys?.auth) return;

        // 5. Save subscription to the backend (upsert — safe to call every page load)
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            userAgent: navigator.userAgent,
          }),
        });
      } catch {
        // Silently ignore — push notifications are a progressive enhancement
      }
    }

    void registerPush();
  }, []);

  return null;
}
