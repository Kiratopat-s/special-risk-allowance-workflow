"use client";

/**
 * useNotifications
 *
 * Manages in-app notification state via SSE stream + server actions.
 *
 * Features:
 * - Connects to /api/notifications/stream (SSE) when mounted
 * - Reconnects automatically with exponential back-off on disconnect
 * - Maintains unread count and a local list of recent notifications
 * - Exposes helpers for marking read / marking all read
 *
 * @module lib/hooks/use-notifications
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
    getMyNotificationPageState,
    markNotificationRead,
    markAllNotificationsRead,
} from "@/app/actions/notifications";
import type { NotificationViewModel, NotificationPayload } from "@/lib/domains/notification";

const MAX_LOCAL = 50; // Max notifications kept in local state
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

export function useNotifications() {
    const [notifications, setNotifications] = useState<NotificationViewModel[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const backoffRef = useRef(BASE_BACKOFF_MS);
    const esRef = useRef<EventSource | null>(null);

    // ---------------------------------------------------------------------------
    // Initial load
    // ---------------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            const result = await getMyNotificationPageState();
            if (!cancelled && result.success) {
                setNotifications(result.data.notifications);
                setUnreadCount(result.data.unreadCount);
            }
            if (!cancelled) setIsLoading(false);
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    // ---------------------------------------------------------------------------
    // SSE stream
    // ---------------------------------------------------------------------------
    useEffect(() => {
        let disposed = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        function clearReconnectTimer() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
        }

        function scheduleReconnect() {
            if (disposed) return;

            clearReconnectTimer();
            const delay = backoffRef.current;
            timeoutId = setTimeout(() => {
                timeoutId = undefined;
                backoffRef.current = Math.min(
                    backoffRef.current * 2,
                    MAX_BACKOFF_MS
                );
                connect();
            }, delay);
        }

        function connect() {
            if (disposed) return;
            if (esRef.current && esRef.current.readyState !== EventSource.CLOSED) {
                return;
            }

            clearReconnectTimer();

            const es = new EventSource("/api/notifications/stream");
            esRef.current = es;

            es.onopen = () => {
                if (esRef.current === es) {
                    backoffRef.current = BASE_BACKOFF_MS;
                }
            };

            es.onmessage = (event: MessageEvent<string>) => {
                try {
                    const payload: NotificationPayload = JSON.parse(event.data);

                    const vm: NotificationViewModel = {
                        id: payload.id,
                        type: payload.type,
                        title: payload.title,
                        body: payload.body,
                        link: payload.link ?? null,
                        isRead: false,
                        readAt: null,
                        createdAt: new Date(payload.createdAt),
                    };

                    setNotifications((prev) => [vm, ...prev].slice(0, MAX_LOCAL));
                    setUnreadCount((c) => c + 1);
                } catch {
                    // malformed JSON — ignore
                }
            };

            es.onerror = (event: Event) => {
                const source = (event.currentTarget ?? event.target) as EventSource | null;
                let errorType = "unknown";

                if (typeof navigator !== "undefined" && navigator.onLine === false) {
                    errorType = "network-offline";
                } else if (source && source.readyState === EventSource.CLOSED) {
                    errorType = "connection-closed";
                } else if (source && source.readyState === EventSource.CONNECTING) {
                    errorType = "reconnecting";
                } else if (source && source.readyState === EventSource.OPEN) {
                    errorType = "server-or-client-error";
                }

                // Basic logging for debugging/monitoring of SSE failures.
                // This does not change the reconnection behavior.
                console.error("[useNotifications] SSE error", {
                    errorType,
                    readyState: source?.readyState,
                });
                es.close();
                if (esRef.current === es) {
                    esRef.current = null;
                }
                scheduleReconnect();
            };
        }

        connect();

        return () => {
            disposed = true;
            clearReconnectTimer();
            esRef.current?.close();
            esRef.current = null;
        };
    }, []);

    // ---------------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------------
    const markRead = useCallback(async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === id ? { ...n, isRead: true, readAt: new Date() } : n
            )
        );
        setUnreadCount((c) => Math.max(0, c - 1));

        await markNotificationRead(id);
    }, []);

    const markAllRead = useCallback(async () => {
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date() }))
        );
        setUnreadCount(0);

        await markAllNotificationsRead();
    }, []);

    return { notifications, unreadCount, isLoading, markRead, markAllRead };
}
