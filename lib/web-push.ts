/**
 * Web Push singleton
 *
 * Configured once with VAPID credentials from env.
 * Call `sendWebPush(userId, payload)` to send to all subscribed devices for a user.
 *
 * @module lib/web-push
 */

import webpush from "web-push";
import { notificationRepository } from "@/lib/domains/notification/repository";
import type { NotificationPayload } from "@/lib/domains/notification/types";

const publicKey = process.env.VAPID_PUBLIC_KEY!;
const privateKey = process.env.VAPID_PRIVATE_KEY!;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@pea.co.th";

if (!publicKey || !privateKey) {
    console.warn("[web-push] VAPID keys not configured — push notifications disabled");
} else {
    webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Send a Web Push notification to all subscribed devices for the given user.
 * Silently removes subscriptions that return 404/410 (expired/unsubscribed).
 */
export async function sendWebPush(
    userId: string,
    payload: NotificationPayload
): Promise<void> {
    if (!publicKey || !privateKey) return;

    const subs = await notificationRepository.findPushSubscriptions(userId);
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.allSettled(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    body
                );
            } catch (err: unknown) {
                // 404 / 410 = subscription expired or user unsubscribed
                const status = (err as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) {
                    await notificationRepository.deletePushSubscription(sub.endpoint);
                }
            }
        })
    );
}

export { webpush };
