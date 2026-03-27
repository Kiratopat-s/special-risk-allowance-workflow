import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notificationService } from "@/lib/domains/notification";

/**
 * POST /api/notifications/subscribe
 *
 * Body: { endpoint: string; p256dh: string; auth: string; userAgent?: string }
 *
 * Saves (or upserts) a Push API subscription for the authenticated user.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    const userId = session?.user?.dbUserId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { endpoint, p256dh, auth: authKey, userAgent } = body as Record<string, unknown>;

    if (
        typeof endpoint !== "string" ||
        typeof p256dh !== "string" ||
        typeof authKey !== "string"
    ) {
        return NextResponse.json(
            { error: "Missing required fields: endpoint, p256dh, auth" },
            { status: 400 }
        );
    }

    const result = await notificationService.savePushSubscription(
        userId,
        endpoint,
        p256dh,
        authKey,
        typeof userAgent === "string" ? userAgent : undefined
    );

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
}
