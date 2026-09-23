import { prisma } from "@/lib/db";
import { PRESENCE_WINDOW_MS, PRESENCE_WRITE_INTERVAL_MS } from "@/lib/presence/constants";
import type { OnlineCountSnapshot } from "@/lib/presence/types";

export const presenceRepository = {
  async heartbeat(userId: string): Promise<void> {
    // Database time keeps expiry consistent across app instances. The condition
    // also prevents simultaneous windows or devices from amplifying row writes.
    await prisma.$executeRaw`
      INSERT INTO "user_presence" ("user_id", "last_seen_at")
      VALUES (${userId}, statement_timestamp())
      ON CONFLICT ("user_id") DO UPDATE
      SET "last_seen_at" = EXCLUDED."last_seen_at"
      WHERE "user_presence"."last_seen_at" <= EXCLUDED."last_seen_at"
        - (${PRESENCE_WRITE_INTERVAL_MS} * INTERVAL '1 millisecond')
    `;
  },

  async getOnlineCount(): Promise<OnlineCountSnapshot> {
    const [snapshot] = await prisma.$queryRaw<Array<{ count: number; measuredAt: Date }>>`
      SELECT COUNT(*)::integer AS "count", statement_timestamp() AS "measuredAt"
      FROM "user_presence"
      WHERE "last_seen_at" > statement_timestamp()
        - (${PRESENCE_WINDOW_MS} * INTERVAL '1 millisecond')
    `;

    return { count: snapshot.count, measuredAt: snapshot.measuredAt.toISOString() };
  },
};
