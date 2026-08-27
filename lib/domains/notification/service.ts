/**
 * Notification Domain – Service Layer
 *
 * Orchestrates: DB persist → SSE broker push → Web Push delivery
 *
 * @module lib/domains/notification/service
 */

import { notificationRepository } from "./repository";
import { success, error, type Result } from "@/lib/shared/types";
import type { PaginatedResult } from "@/lib/shared/types";
import type {
    NotificationViewModel,
    NotificationPageState,
    CreateNotificationInput,
    NotificationPayload,
} from "./types";
import type { NotificationType } from "@/lib/generated/prisma/client";

// Lazy-import to avoid circular deps and to keep this module server-only
async function getBroker() {
    const { notificationBroker } = await import("@/lib/notification-broker");
    return notificationBroker;
}

async function getWebPush() {
    const { sendWebPush } = await import("@/lib/web-push");
    return sendWebPush;
}

function toPayload(n: NotificationViewModel): NotificationPayload {
    return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
    };
}

export const notificationService = {
    /**
     * Persist a notification, push via SSE (if connected) and Web Push (if subscribed).
     * Fire-and-forget safe — errors are caught and logged, never thrown.
     */
    async send(
        userId: string,
        type: NotificationType,
        title: string,
        body: string,
        link?: string
    ): Promise<void> {
        try {
            const input: CreateNotificationInput = { userId, type, title, body, link };
            const entity = await notificationRepository.create(input);
            const viewModel: NotificationViewModel = {
                id: entity.id,
                type: entity.type,
                title: entity.title,
                body: entity.body,
                link: entity.link,
                isRead: entity.isRead,
                readAt: entity.readAt,
                createdAt: entity.createdAt,
            };
            const payload = toPayload(viewModel);

            console.log(`[notification-service] Sending notification to user ${userId.slice(0, 8)}… (type: ${type})`);

            // SSE — fire and forget
            getBroker()
                .then((broker) => broker.push(userId, payload))
                .catch((err) => console.error("[notification-service] SSE push failed:", err));

            // Web Push — fire and forget
            getWebPush()
                .then((sendFn) => sendFn(userId, payload))
                .catch((err) => console.error("[notification-service] Web Push failed:", err));
        } catch (err) {
            console.error("[notification-service] send() failed:", err);
        }
    },

    /** Send the same notification to multiple users (e.g. broadcast). */
    async sendToMany(
        userIds: string[],
        type: NotificationType,
        title: string,
        body: string,
        link?: string
    ): Promise<void> {
        await Promise.allSettled(
            userIds.map((uid) => notificationService.send(uid, type, title, body, link))
        );
    },

    // ---------------------------------------------------------------------------
    // Queries (used by server actions)
    // ---------------------------------------------------------------------------

    async getPage(
        userId: string,
        page?: number
    ): Promise<Result<PaginatedResult<NotificationViewModel>>> {
        const result = await notificationRepository.findByUserId(userId, page ?? 1);
        return success(result);
    },

    async getUnreadCount(userId: string): Promise<Result<number>> {
        const count = await notificationRepository.countUnread(userId);
        return success(count);
    },

    async getPageState(userId: string): Promise<Result<NotificationPageState>> {
        const [pageResult, count] = await Promise.all([
            notificationRepository.findByUserId(userId, 1, 30),
            notificationRepository.countUnread(userId),
        ]);
        return success({ notifications: pageResult.data, unreadCount: count });
    },

    // ---------------------------------------------------------------------------
    // Mutations
    // ---------------------------------------------------------------------------

    async markRead(id: string, userId: string): Promise<Result<void>> {
        await notificationRepository.markRead(id, userId);
        return success(undefined);
    },

    async markAllRead(userId: string): Promise<Result<void>> {
        await notificationRepository.markAllRead(userId);
        return success(undefined);
    },

    async softDelete(id: string, userId: string): Promise<Result<void>> {
        await notificationRepository.softDelete(id, userId);
        return success(undefined);
    },

    async softDeleteAllRead(userId: string): Promise<Result<number>> {
        const count = await notificationRepository.softDeleteAllRead(userId);
        return success(count);
    },

    // ---------------------------------------------------------------------------
    // Push subscription management
    // ---------------------------------------------------------------------------

    async savePushSubscription(
        userId: string,
        endpoint: string,
        p256dh: string,
        auth: string,
        userAgent?: string
    ): Promise<Result<void>> {
        if (!endpoint || !p256dh || !auth) {
            return error("Invalid push subscription data", "INVALID_PUSH_SUB");
        }
        await notificationRepository.savePushSubscription({
            userId,
            endpoint,
            p256dh,
            auth,
            userAgent,
        });
        return success(undefined);
    },

    async removePushSubscription(endpoint: string, userId: string): Promise<Result<void>> {
        await notificationRepository.deletePushSubscriptionByEndpoint(endpoint, userId);
        return success(undefined);
    },
};
