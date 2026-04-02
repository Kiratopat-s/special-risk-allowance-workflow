"use client";

/**
 * usePushSubscription
 *
 * Manages the browser's Push API subscription lifecycle:
 * - Requests notification permission on demand (user-gesture required)
 * - Creates push subscriptions via the Push API + VAPID key
 * - Registers / unregisters push subscriptions against the backend
 *
 * @module lib/hooks/use-push-subscription
 */

import { useState, useCallback, useEffect } from "react";

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

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

/**
 * Subscribe the current browser to Web Push via the Push API.
 * Fetches the VAPID public key, creates a PushSubscription, and saves it to the backend.
 * Returns true on success.
 */
export async function subscribeToPush(): Promise<boolean> {
    try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (!registration) {
            console.warn("[Push] No service worker registration found");
            return false;
        }

        // Fetch the VAPID public key
        const keyRes = await fetch("/api/notifications/vapid-public-key");
        if (!keyRes.ok) {
            console.warn("[Push] Failed to fetch VAPID public key:", keyRes.status);
            return false;
        }
        const { publicKey } = (await keyRes.json()) as { publicKey: string };

        // Subscribe (reuses existing subscription if one already exists)
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        });

        const json = subscription.toJSON();
        if (!json.keys?.p256dh || !json.keys?.auth) {
            console.warn("[Push] Subscription missing keys");
            return false;
        }

        // Save subscription to the backend (upsert — safe to call repeatedly)
        const saveRes = await fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                userAgent: navigator.userAgent,
            }),
        });

        if (!saveRes.ok) {
            console.warn("[Push] Failed to save subscription:", saveRes.status);
            return false;
        }

        console.log("[Push] Subscription saved successfully");
        return true;
    } catch (err) {
        // Detect push service blocked by browser (Brave, privacy settings, etc.)
        if (err instanceof DOMException && (err.name === "AbortError" || err.name === "NotAllowedError")) {
            console.warn("[Push] Push service blocked by browser:", err.message);
            throw new Error("PUSH_SERVICE_BLOCKED");
        }
        console.error("[Push] subscribeToPush failed:", err);
        throw new Error("PUSH_SUBSCRIBE_FAILED");
    }
}

export function usePushSubscription() {
    const [permission, setPermission] = useState<PushPermissionState>(() => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return "unsupported";
        }
        return Notification.permission as PushPermissionState;
    });
    const [isLoading, setIsLoading] = useState(false);

    // Sync permission state when it changes externally (e.g. browser settings)
    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        setPermission(Notification.permission as PushPermissionState);
    }, []);

    /**
     * Request notification permission (must be called from a user gesture)
     * and auto-subscribe to push if granted.
     */
    /**
     * Request notification permission (must be called from a user gesture)
     * and auto-subscribe to push if granted.
     *
     * Returns { ok: true } on success, or { ok: false, reason } on failure.
     * reason: "denied" | "push_blocked" | "failed"
     */
    const subscribe = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: "denied" | "push_blocked" | "failed" }> => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return { ok: false, reason: "failed" };
        }
        if (Notification.permission === "denied") {
            setPermission("denied");
            return { ok: false, reason: "denied" };
        }

        setIsLoading(true);
        try {
            // If not yet granted, request permission first (requires user gesture)
            if (Notification.permission !== "granted") {
                const result = await Notification.requestPermission();
                setPermission(result as PushPermissionState);
                if (result !== "granted") return { ok: false, reason: "denied" };
            } else {
                setPermission("granted");
            }

            // Permission granted — create push subscription
            const success = await subscribeToPush();
            return success ? { ok: true } : { ok: false, reason: "failed" };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg === "PUSH_SERVICE_BLOCKED") {
                return { ok: false, reason: "push_blocked" };
            }
            return { ok: false, reason: "failed" };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const unsubscribe = useCallback(async (): Promise<void> => {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg) return;

        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;

        try {
            await fetch("/api/notifications/unsubscribe", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });

            await sub.unsubscribe();
            setPermission("default");
            console.log("[Push] Unsubscribed successfully");
        } catch (err) {
            console.error("[Push] Unsubscribe failed:", err);
        }
    }, []);

    return { permission, isLoading, subscribe, unsubscribe };
}
