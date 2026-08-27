/**
 * Notification Domain – Repository Layer
 *
 * @module lib/domains/notification/repository
 */

import { prisma } from "@/lib/db";
import type {
    NotificationEntity,
    NotificationViewModel,
    CreateNotificationInput,
    SavePushSubscriptionInput,
} from "./types";
import type { PushSubscription } from "@/lib/generated/prisma/client";
import type { PaginatedResult } from "@/lib/shared/types";

function toViewModel(n: NotificationEntity): NotificationViewModel {
    return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.isRead,
        readAt: n.readAt,
        createdAt: n.createdAt,
    };
}

export const notificationRepository = {
    // -------------------------------------------------------------------------
    // Notification CRUD
    // -------------------------------------------------------------------------

    async create(input: CreateNotificationInput): Promise<NotificationEntity> {
        return prisma.notification.create({
            data: {
                userId: input.userId,
                type: input.type,
                title: input.title,
                body: input.body,
                link: input.link ?? null,
            },
        });
    },

    async findByUserId(
        userId: string,
        page = 1,
        pageSize = 20
    ): Promise<PaginatedResult<NotificationViewModel>> {
        const skip = (page - 1) * pageSize;
        const [rows, total] = await prisma.$transaction([
            prisma.notification.findMany({
                where: { userId, isDeleted: false },
                orderBy: { createdAt: "desc" },
                skip,
                take: pageSize,
            }),
            prisma.notification.count({ where: { userId, isDeleted: false } }),
        ]);

        return {
            data: rows.map(toViewModel),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasNext: skip + pageSize < total,
                hasPrevious: page > 1,
            },
        };
    },

    async countUnread(userId: string): Promise<number> {
        return prisma.notification.count({ where: { userId, isRead: false, isDeleted: false } });
    },

    async markRead(id: string, userId: string): Promise<void> {
        await prisma.notification.updateMany({
            where: { id, userId },
            data: { isRead: true, readAt: new Date() },
        });
    },

    async markAllRead(userId: string): Promise<void> {
        await prisma.notification.updateMany({
            where: { userId, isRead: false, isDeleted: false },
            data: { isRead: true, readAt: new Date() },
        });
    },

    async softDelete(id: string, userId: string): Promise<void> {
        await prisma.notification.updateMany({
            where: { id, userId, isDeleted: false },
            data: { isDeleted: true, deletedAt: new Date() },
        });
    },

    async softDeleteAllRead(userId: string): Promise<number> {
        const result = await prisma.notification.updateMany({
            where: { userId, isRead: true, isDeleted: false },
            data: { isDeleted: true, deletedAt: new Date() },
        });
        return result.count;
    },

    // -------------------------------------------------------------------------
    // Push subscriptions
    // -------------------------------------------------------------------------

    async findPushSubscriptions(userId: string): Promise<PushSubscription[]> {
        return prisma.pushSubscription.findMany({ where: { userId } });
    },

    async savePushSubscription(input: SavePushSubscriptionInput): Promise<void> {
        await prisma.pushSubscription.upsert({
            where: { endpoint: input.endpoint },
            update: {
                p256dh: input.p256dh,
                auth: input.auth,
                userAgent: input.userAgent ?? null,
            },
            create: {
                userId: input.userId,
                endpoint: input.endpoint,
                p256dh: input.p256dh,
                auth: input.auth,
                userAgent: input.userAgent ?? null,
            },
        });
    },

    async deletePushSubscription(endpoint: string): Promise<void> {
        await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    },

    async deletePushSubscriptionByEndpoint(endpoint: string, userId: string): Promise<void> {
        await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    },

    async deletePushSubscriptionById(id: string, userId: string): Promise<void> {
        await prisma.pushSubscription.deleteMany({ where: { id, userId } });
    },
};
