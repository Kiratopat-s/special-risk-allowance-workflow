import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notificationService } from "@/lib/domains/notification";

/**
 * DELETE /api/notifications/unsubscribe
 *
 * Body: { endpoint: string }
 *
 * Removes a Push API subscription. The authenticated user is implicitly the owner
 * (the repository has no ownership guard for deletions by endpoint, so we just
 * require authentication to prevent blind endpoint removal by third parties).
 */
export async function DELETE(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.dbUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { endpoint } = body as Record<string, unknown>;

    if (typeof endpoint !== "string") {
        return NextResponse.json(
            { error: "Missing required field: endpoint" },
            { status: 400 }
        );
    }

    const result = await notificationService.removePushSubscription(endpoint, session.user.dbUserId);

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
