"use client";

/**
 * usePushSubscription
 *
 * Manages the browser's Push API subscription lifecycle:
 * - Requests notification permission on demand
 * - Registers / unregisters push subscriptions against the backend
 *
 * @module lib/hooks/use-push-subscription
 */

import { useState, useCallback } from "react";

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

export function usePushSubscription() {
    const [permission, setPermission] = useState<PushPermissionState>(() => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            return "unsupported";
        }
        return Notification.permission as PushPermissionState;
    });
    const [isLoading, setIsLoading] = useState(false);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        if (typeof window === "undefined" || !("Notification" in window)) return false;
        if (Notification.permission === "denied") {
            setPermission("denied");
            return false;
        }

        setIsLoading(true);
        try {
            const result = await Notification.requestPermission();
            setPermission(result as PushPermissionState);
            return result === "granted";
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

        await fetch("/api/notifications/unsubscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
        });

        await sub.unsubscribe();
        setPermission("default");
    }, []);

    return { permission, isLoading, requestPermission, unsubscribe };
}
