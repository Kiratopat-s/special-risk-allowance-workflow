/**
 * In-memory SSE fan-out broker for server-sent notifications.
 *
 * Works for a single-server deployment.
 * Keys are userId strings; values are sets of writer functions.
 *
 * The subscribers Map is attached to globalThis so it survives
 * Next.js dev-mode hot module reloads (HMR).
 *
 * @module lib/notification-broker
 */

import type { NotificationPayload } from "@/lib/domains/notification/types";

type SseWriter = (data: string) => void;

const globalForBroker = globalThis as unknown as {
    __notificationSubscribers?: Map<string, Set<SseWriter>>;
};

const subscribers =
    globalForBroker.__notificationSubscribers ??
    (globalForBroker.__notificationSubscribers = new Map<string, Set<SseWriter>>());

export const notificationBroker = {
    /**
     * Register an SSE writer for a user.
     * Returns a cleanup function that must be called on stream close.
     */
    subscribe(userId: string, writer: SseWriter): () => void {
        if (!subscribers.has(userId)) {
            subscribers.set(userId, new Set());
        }
        subscribers.get(userId)!.add(writer);

        return () => {
            const set = subscribers.get(userId);
            if (set) {
                set.delete(writer);
                if (set.size === 0) subscribers.delete(userId);
            }
        };
    },

    /**
     * Fan-out a payload to all open SSE connections for a user.
     * Silently ignores errors from individual writers.
     */
    push(userId: string, payload: NotificationPayload): void {
        const set = subscribers.get(userId);
        if (!set || set.size === 0) {
            console.log(`[SSE] No active connections for user ${userId.slice(0, 8)}… (${subscribers.size} total users subscribed)`);
            return;
        }

        const data = `data: ${JSON.stringify(payload)}\n\n`;
        for (const writer of set) {
            try {
                writer(data);
            } catch {
                // writer may have closed between check and write — ignore
            }
        }
        console.log(`[SSE] Pushed to ${set.size} connection(s) for user ${userId.slice(0, 8)}…`);
    },

    /** Current subscriber count for a user (useful for diagnostics). */
    count(userId: string): number {
        return subscribers.get(userId)?.size ?? 0;
    },
};
