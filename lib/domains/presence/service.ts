import { error, success, type Result } from "@/lib/shared/types";
import { PRESENCE_CACHE_MS } from "@/lib/presence/constants";
import type { OnlineCountSnapshot } from "@/lib/presence/types";
import { presenceRepository } from "./repository";

/** Each app process caches only aggregate snapshots; PostgreSQL owns presence. */
export function createPresenceService(
  repository = presenceRepository,
  monotonicNow: () => number = () => performance.now(),
) {
  let cached: { snapshot: OnlineCountSnapshot; expiresAt: number } | undefined;
  let inFlight: Promise<OnlineCountSnapshot> | undefined;

  function getCount(): Promise<OnlineCountSnapshot> {
    if (cached && monotonicNow() < cached.expiresAt) {
      return Promise.resolve(cached.snapshot);
    }
    if (inFlight) return inFlight;

    // Start TTL before the query: DB/server clock differences and slow queries
    // must not make an old snapshot look fresh for another full cache interval.
    const expiresAt = monotonicNow() + PRESENCE_CACHE_MS;
    inFlight = repository.getOnlineCount()
      .then((snapshot) => {
        cached = { snapshot, expiresAt };
        return snapshot;
      })
      .finally(() => { inFlight = undefined; });
    return inFlight;
  }

  return {
    async heartbeat(userId: string): Promise<Result<OnlineCountSnapshot>> {
      try {
        // Complete the write first. A COUNT in the same data-modifying SQL CTE
        // would use its earlier snapshot and could miss the inserted user.
        await repository.heartbeat(userId);
        return success(await getCount());
      } catch (cause) {
        console.error("[presence] Unable to update online count", cause);
        return error("Unable to update online count", "PRESENCE_UNAVAILABLE");
      }
    },
  };
}

export const presenceService = createPresenceService();
