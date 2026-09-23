import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { presenceService } from "@/lib/domains/presence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store" };

// The wrapper carries any refreshed session cookies onto the response.
const authenticatedHeartbeat = auth(async (request) => {
  const userId = request.auth?.user?.dbUserId;
  if (!userId || request.auth?.error === "RefreshAccessTokenError") {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401, headers });
  }

  // Identity and timestamps always come from the server, never a client body.
  const result = await presenceService.heartbeat(userId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: "Presence unavailable", code: "PRESENCE_UNAVAILABLE" }, { status: 503, headers });
  }

  return NextResponse.json(result, { headers });
});

export async function POST(request: NextRequest) {
  // Check before auth, which can itself refresh tokens and synchronize profiles.
  // Use the same canonical public URL as Auth.js behind the reverse proxy.
  const expectedOrigin = new URL(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? request.nextUrl.origin).origin;
  if (request.headers.get("Origin") !== expectedOrigin || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return NextResponse.json({ success: false, error: "Forbidden", code: "FORBIDDEN" }, { status: 403, headers });
  }

  return authenticatedHeartbeat(request, { params: Promise.resolve({}) });
}
