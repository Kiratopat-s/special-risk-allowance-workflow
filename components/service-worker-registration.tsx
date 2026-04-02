"use client";

/**
 * ServiceWorkerRegistration
 *
 * Mounts once (client only, authenticated users only) and:
 * 1. Registers /sw.js as a service worker.
 * 2. If permission is already "granted", auto-subscribes to push.
 *
 * Push subscription for new users is triggered via the permission prompt
 * in NotificationBell (user gesture required).
 *
 * This component renders nothing visible — it purely handles registration.
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { subscribeToPush } from "@/lib/hooks/use-push-subscription";

export function ServiceWorkerRegistration() {
  const { status } = useSession();

  useEffect(() => {
    // Only run for authenticated users
    if (status !== "authenticated") return;

    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      console.warn("[SW] Browser does not support service workers or Push API");
      return;
    }

    async function register() {
      try {
        // 1. Register the service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log("[SW] Service worker registered:", registration.scope);

        // Wait for the SW to be active
        await navigator.serviceWorker.ready;
        console.log("[SW] Service worker ready");

        // 2. If permission is already granted, auto-subscribe to push
        //    (handles returning users / page reloads)
        if (Notification.permission === "granted") {
          console.log("[Push] Permission already granted — auto-subscribing");
          try {
            await subscribeToPush();
          } catch {
            // Push service may be blocked (e.g. Brave) — not critical
            console.warn(
              "[Push] Auto-subscribe failed (push service may be blocked)",
            );
          }
        } else {
          console.log(
            "[Push] Permission is",
            JSON.stringify(Notification.permission),
            "— waiting for user to enable via bell prompt",
          );
        }
      } catch (err) {
        console.error("[SW] Registration failed:", err);
      }
    }

    void register();
  }, [status]);

  return null;
}
