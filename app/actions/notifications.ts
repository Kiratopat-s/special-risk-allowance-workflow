"use server";

/**
 * Notification Server Actions
 *
 * Permission requirements:
 *   - All users: read/manage their own notifications
 *   - ADMIN role only: sendSystemNotification (broadcast)
 *
 * @module app/actions/notifications
 */

import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth/permissions";
import {
    notificationService,
    type NotificationType,
} from "@/lib/domains/notification";
import type { Result, PaginatedResult } from "@/lib/shared/types";
import type {
    NotificationViewModel,
    NotificationPageState,
} from "@/lib/domains/notification";

/** Get paginated notifications for the current user. */
export async function getMyNotifications(
    page = 1
): Promise<Result<PaginatedResult<NotificationViewModel>>> {
    const session = await auth();
    const userId = session?.user?.dbUserId;
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    return notificationService.getPage(userId, page);
}

/** Get unread count for the current user (for the bell badge). */
export async function getMyUnreadCount(): Promise<Result<number>> {
    const session = await auth();
    const userId = session?.user?.dbUserId;
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    return notificationService.getUnreadCount(userId);
}

/**
 * Fetch both the notification list and unread count in a single call
 * — used on initial bell panel open to avoid double waterfall.
 */
export async function getMyNotificationPageState(): Promise<
    Result<NotificationPageState>
> {
    const session = await auth();
    const userId = session?.user?.dbUserId;
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    return notificationService.getPageState(userId);
}

/** Mark a single notification as read. */
export async function markNotificationRead(id: string): Promise<Result<void>> {
    const session = await auth();
    const userId = session?.user?.dbUserId;
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    return notificationService.markRead(id, userId);
}

/** Mark all notifications as read for the current user. */
export async function markAllNotificationsRead(): Promise<Result<void>> {
    const session = await auth();
    const userId = session?.user?.dbUserId;
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    return notificationService.markAllRead(userId);
}

/**
 * Broadcast a system announcement to specific users or all users.
 * Requires ADMIN role.
 *
 * @param userIds - Target user IDs. Pass an empty array to skip (no-op).
 */
export async function sendSystemNotification(
    userIds: string[],
    title: string,
    body: string,
    link?: string
): Promise<Result<void>> {
    const session = await auth();
    const userId = session?.user?.dbUserId;
    if (!userId) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };

    const isAdmin = await hasRole(userId, "ADMIN");
    if (!isAdmin) {
        return { success: false, error: "Permission denied", code: "PERMISSION_DENIED" };
    }

    if (userIds.length === 0) {
        return { success: true, data: undefined };
    }

    await notificationService.sendToMany(
        userIds,
        "SYSTEM_ANNOUNCEMENT" as NotificationType,
        title,
        body,
        link
    );

    return { success: true, data: undefined };
}
