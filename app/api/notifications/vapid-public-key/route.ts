import { NextResponse } from "next/server";

/**
 * GET /api/notifications/vapid-public-key
 *
 * Returns the VAPID public key needed by the browser to subscribe to push.
 * Does not require authentication — the key is public by design.
 */
export function GET() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
        return NextResponse.json(
            { error: "Push notifications are not configured" },
            { status: 503 }
        );
    }

    return NextResponse.json({ publicKey });
}
