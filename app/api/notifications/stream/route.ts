import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notificationBroker } from "@/lib/notification-broker";

/** Heartbeat interval in milliseconds to keep the connection alive. */
const HEARTBEAT_MS = 25_000;

/**
 * GET /api/notifications/stream
 *
 * Opens a Server-Sent Events (SSE) stream for the authenticated user.
 * Sends a heartbeat comment every 25 seconds to prevent proxy timeouts.
 * The client should reconnect automatically on disconnect (EventSource default behaviour).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
    const session = await auth();
    const userId = session?.user?.dbUserId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let cleanup: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            // Send an initial "connected" comment so the client knows the stream is live
            controller.enqueue(encoder.encode(": connected\n\n"));

            // Register SSE writer with the broker
            cleanup = notificationBroker.subscribe(userId, (data: string) => {
                try {
                    controller.enqueue(encoder.encode(data));
                } catch {
                    // Controller may have been closed — broker will clean up on the next push
                }
            });

            // Periodic heartbeat to keep intermediary proxies from closing the connection
            heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": heartbeat\n\n"));
                } catch {
                    clearInterval(heartbeat);
                }
            }, HEARTBEAT_MS);
        },

        cancel() {
            clearInterval(heartbeat);
            cleanup?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // disable nginx buffering
        },
    });
}
