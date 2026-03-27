/**
 * Notification Domain – Types
 *
 * @module lib/domains/notification/types
 */

import type { Notification, NotificationType } from "@/lib/generated/prisma/client";

// Re-export for convenience
export type { NotificationType };

export type NotificationEntity = Notification;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CreateNotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
}

export interface SavePushSubscriptionInput {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
}

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export interface NotificationViewModel {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
}

export interface NotificationPageState {
    notifications: NotificationViewModel[];
    unreadCount: number;
}

// Payload sent over SSE and Web Push
export interface NotificationPayload {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string | null;
    createdAt: string; // ISO string — serialisable
}
