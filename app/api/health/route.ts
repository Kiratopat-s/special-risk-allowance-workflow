import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Readiness endpoint for container orchestration and the host reverse proxy.
 * It intentionally exposes no database or configuration details.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("[health] Database readiness check failed", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
