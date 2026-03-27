/**
 * In-memory SSE fan-out broker for server-sent notifications.
 *
 * Works for a single-server deployment.
 * Keys are userId strings; values are sets of writer functions.
 *
 * @module lib/notification-broker
 */

import type { NotificationPayload } from "@/lib/domains/notification/types";

type SseWriter = (data: string) => void;

const subscribers = new Map<string, Set<SseWriter>>();

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
        if (!set || set.size === 0) return;

        const data = `data: ${JSON.stringify(payload)}\n\n`;
        for (const writer of set) {
            try {
                writer(data);
            } catch {
                // writer may have closed between check and write — ignore
            }
        }
    },

    /** Current subscriber count for a user (useful for diagnostics). */
    count(userId: string): number {
        return subscribers.get(userId)?.size ?? 0;
    },
};
