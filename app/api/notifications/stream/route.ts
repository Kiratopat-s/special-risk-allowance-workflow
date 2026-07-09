import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
    const session = await auth();
    const userId = session?.user?.dbUserId;

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let cleanupStream: (() => void) | undefined;

    const stream = new ReadableStream({
        start(controller) {
            let isClosed = false;
            const encoder = new TextEncoder();
            const heartbeatRef: { current?: ReturnType<typeof setInterval> } = {};
            const abortHandler = () => cleanupStream?.();

            cleanupStream = () => {
                if (isClosed) return;
                isClosed = true;
                clearInterval(heartbeatRef.current);
                cleanup?.();
                request.signal.removeEventListener("abort", abortHandler);

                try {
                    controller.close();
                } catch {
                    // The stream may already be closed by the runtime.
                }
            };

            const enqueue = (data: string): boolean => {
                if (isClosed) return false;

                try {
                    controller.enqueue(encoder.encode(data));
                    return true;
                } catch {
                    cleanupStream?.();
                    return false;
                }
            };

            // Register SSE writer with the broker
            const writer = (data: string) => enqueue(data);
            const cleanup = notificationBroker.subscribe(userId, writer);

            request.signal.addEventListener("abort", abortHandler, { once: true });

            if (request.signal.aborted) {
                cleanupStream();
                return;
            }

            // Send an initial "connected" comment so the client knows the stream is live
            if (!enqueue(": connected\n\n")) {
                notificationBroker.remove(userId, writer);
                return;
            }

            // Periodic heartbeat to keep intermediary proxies from closing the connection
            heartbeatRef.current = setInterval(() => {
                enqueue(": heartbeat\n\n");
            }, HEARTBEAT_MS);
        },

        cancel() {
            cleanupStream?.();
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
