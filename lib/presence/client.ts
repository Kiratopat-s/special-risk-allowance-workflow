import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_JITTER_MS,
  HEARTBEAT_TIMEOUT_MS,
  PRESENCE_STALE_MS,
} from "@/lib/presence/constants";
import type { OnlineCountSnapshot } from "@/lib/presence/types";

export type PresenceState = {
  status: "loading" | "live" | "stale" | "unavailable" | "disabled";
  count: number | null;
  measuredAt: string | null;
};

export const DISABLED_PRESENCE: PresenceState = {
  status: "disabled",
  count: null,
  measuredAt: null,
};

type ActiveRequest = {
  controller: AbortController;
  cancelled: boolean;
  timeout: ReturnType<typeof setTimeout>;
};

function isSnapshotResult(value: unknown): value is {
  success: true;
  data: OnlineCountSnapshot;
} {
  if (!value || typeof value !== "object" || !("success" in value) ||
      value.success !== true || !("data" in value)) return false;
  const data = value.data;
  return !!data && typeof data === "object" &&
    "count" in data && typeof data.count === "number" &&
    Number.isSafeInteger(data.count) && data.count >= 0 &&
    "measuredAt" in data && typeof data.measuredAt === "string" &&
    Number.isFinite(Date.parse(data.measuredAt));
}

/** One controller per provider. Consumers never create timers or requests. */
export class PresenceController {
  private state: PresenceState = DISABLED_PRESENCE;
  private listeners = new Set<() => void>();
  private userId: string | null = null;
  private running = false;
  private suspended = false;
  private dueAt = 0;
  private freshUntil = 0;
  private failures = 0;
  private request: ActiveRequest | null = null;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private freshnessTimer?: ReturnType<typeof setTimeout>;

  constructor(private onUnauthorized: () => Promise<unknown>) {}

  setSessionRecheck(onUnauthorized: () => Promise<unknown>) {
    this.onUnauthorized = onUnauthorized;
  }

  getSnapshot = () => this.state;
  getServerSnapshot = () => DISABLED_PRESENCE;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  start() {
    this.running = true;
    document.addEventListener("visibilitychange", this.environmentChanged);
    window.addEventListener("online", this.environmentChanged);
    window.addEventListener("offline", this.environmentChanged);
    this.refreshFreshness();
    this.schedule();
  }

  stop() {
    this.running = false;
    document.removeEventListener("visibilitychange", this.environmentChanged);
    window.removeEventListener("online", this.environmentChanged);
    window.removeEventListener("offline", this.environmentChanged);
    clearTimeout(this.pollTimer);
    clearTimeout(this.freshnessTimer);
    this.cancelRequest();
  }

  setUserId(userId: string | null) {
    if (this.userId === userId) return;
    this.cancelRequest();
    this.userId = userId;
    this.suspended = false;
    this.failures = 0;
    this.dueAt = Date.now();
    this.freshUntil = 0;
    clearTimeout(this.freshnessTimer);
    this.publish(userId
      ? { status: "loading", count: null, measuredAt: null }
      : DISABLED_PRESENCE);
    this.schedule();
  }

  private publish(state: PresenceState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private canPoll() {
    return this.running && !!this.userId && !this.suspended &&
      document.visibilityState === "visible" && navigator.onLine;
  }

  private cancelRequest() {
    if (!this.request) return;
    this.request.cancelled = true;
    clearTimeout(this.request.timeout);
    this.request.controller.abort();
    // Keep the slot until fetch settles, even across hide/show or account changes.
  }

  private environmentChanged = () => {
    this.refreshFreshness();
    if (!this.canPoll()) this.cancelRequest();
    this.schedule();
  };

  private schedule() {
    clearTimeout(this.pollTimer);
    if (!this.canPoll() || this.request) return;
    // Deferring the initial request also avoids duplicate sends in Strict Mode.
    this.pollTimer = setTimeout(() => { void this.heartbeat(); }, Math.max(0, this.dueAt - Date.now()));
  }

  private refreshFreshness() {
    clearTimeout(this.freshnessTimer);
    if (!this.running || !this.freshUntil || this.state.count === null) return;
    const remaining = this.freshUntil - Date.now();
    if (remaining <= 0) {
      this.publish({ status: "unavailable", count: null, measuredAt: this.state.measuredAt });
    } else {
      this.freshnessTimer = setTimeout(() => this.refreshFreshness(), remaining);
    }
  }

  private markFailure() {
    this.refreshFreshness();
    this.publish({
      ...this.state,
      status: this.state.count === null ? "unavailable" : "stale",
    });
  }

  private async heartbeat() {
    if (!this.canPoll() || this.request) return;
    const controller = new AbortController();
    const request: ActiveRequest = {
      controller,
      cancelled: false,
      timeout: setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS),
    };
    this.request = request;
    // Reserve the next slot before sending so visibility changes cannot spam.
    this.dueAt = Date.now() + HEARTBEAT_INTERVAL_MS +
      (Math.random() * 2 - 1) * HEARTBEAT_JITTER_MS;
    const isCurrent = () => this.running && !request.cancelled && this.request === request;
    try {
      const response = await fetch("/api/presence", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      if (response.status === 401) {
        this.suspended = true;
        this.markFailure();
        // A session update temporarily sets status=loading. The provider retains
        // the identity during that update, so it cannot restart this 401 loop.
        void Promise.resolve().then(this.onUnauthorized).catch(() => undefined);
        return;
      }
      if (!response.ok) throw new Error("Presence request failed");
      const result: unknown = await response.json();
      if (!isCurrent()) return;
      if (!isSnapshotResult(result)) throw new Error("Invalid presence response");
      this.failures = 0;
      // Use receipt time to avoid comparing the database clock to device time.
      this.freshUntil = Date.now() + PRESENCE_STALE_MS;
      this.publish({ status: "live", count: result.data.count, measuredAt: result.data.measuredAt });
      this.refreshFreshness();
    } catch {
      if (!isCurrent()) return;
      this.failures += 1;
      this.dueAt = Date.now() + Math.min(HEARTBEAT_INTERVAL_MS * 2 ** Math.min(this.failures - 1, 3), 300_000);
      this.markFailure();
    } finally {
      clearTimeout(request.timeout);
      if (this.request === request) this.request = null;
      this.schedule();
    }
  }
}
