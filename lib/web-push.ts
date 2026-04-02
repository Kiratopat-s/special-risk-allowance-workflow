/**
 * Web Push singleton
 *
 * Configured once with VAPID credentials from env.
 * Call `sendWebPush(userId, payload)` to send to all subscribed devices for a user.
 *
 * The webpush instance is attached to globalThis so VAPID config survives
 * Next.js dev-mode hot module reloads (HMR).
 *
 * @module lib/web-push
 */

import webpush from "web-push";
import { notificationRepository } from "@/lib/domains/notification/repository";
import type { NotificationPayload } from "@/lib/domains/notification/types";

const publicKey = process.env.VAPID_PUBLIC_KEY!;
const privateKey = process.env.VAPID_PRIVATE_KEY!;
const subject = process.env.VAPID_SUBJECT ?? "mailto:capacity1412@gmail.com";

const globalForWebPush = globalThis as unknown as { __webPushConfigured?: boolean };

if (!publicKey || !privateKey) {
    console.warn("[web-push] VAPID keys not configured — push notifications disabled");
} else if (!globalForWebPush.__webPushConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    globalForWebPush.__webPushConfigured = true;
    console.log("[web-push] VAPID details configured");
}

/**
 * Send a Web Push notification to all subscribed devices for the given user.
 * Silently removes subscriptions that return 404/410/403 (expired/unsubscribed/VAPID mismatch).
 */
export async function sendWebPush(
    userId: string,
    payload: NotificationPayload
): Promise<void> {
    if (!publicKey || !privateKey) {
        console.warn("[web-push] Skipping — VAPID keys not configured");
        return;
    }

    const subs = await notificationRepository.findPushSubscriptions(userId);
    console.log(`[web-push] Sending to ${subs.length} device(s) for user ${userId.slice(0, 8)}…`);
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);

    await Promise.allSettled(
        subs.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    body
                );
                console.log("[web-push] Sent successfully to:", sub.endpoint.slice(0, 60));
            } catch (err: unknown) {
                const status = (err as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410 || status === 403) {
                    // 404/410 = expired/unsubscribed, 403 = VAPID key mismatch — all unrecoverable
                    console.log("[web-push] Removing invalid subscription (status %d):", status, sub.endpoint.slice(0, 60));
                    await notificationRepository.deletePushSubscription(sub.endpoint);
                } else {
                    console.error("[web-push] Failed to send push:", { statusCode: status, endpoint: sub.endpoint.slice(0, 60), error: err });
                }
            }
        })
    );
}

export { webpush };
