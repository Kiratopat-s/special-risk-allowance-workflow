// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { PresenceProvider, usePresence } from "@/components/presence-provider";

const auth = vi.hoisted(() => ({
  session: null as Session | null,
  status: "authenticated" as "loading" | "authenticated" | "unauthenticated",
  update: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({
  data: auth.session, status: auth.status, update: auth.update,
}) }));

let visibility: DocumentVisibilityState;
let online: boolean;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function Reader({ name = "presence" }: { name?: string }) {
  const state = usePresence();
  return <output data-testid={name}>{JSON.stringify(state)}</output>;
}

function App({ menu = false }: { menu?: boolean }) {
  return <PresenceProvider><Reader />{menu && <Reader name="mobile" />}</PresenceProvider>;
}

function state() {
  return JSON.parse(screen.getByTestId("presence").textContent!);
}

function result(count = 1234, measuredAt = new Date().toISOString()) {
  return Response.json({ success: true, data: { count, measuredAt } });
}

function session(userId: string): Session {
  return { user: { id: userId, dbUserId: userId }, expires: "2099-01-01T00:00:00.000Z" };
}

async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

async function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
}

async function setOnline(next: boolean) {
  online = next;
  await act(async () => { window.dispatchEvent(new Event(next ? "online" : "offline")); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T00:00:00.000Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  visibility = "visible";
  online = true;
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  auth.session = session("user-1");
  auth.status = "authenticated";
  auth.update.mockReset().mockResolvedValue(auth.session);
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => result());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("shared polling", () => {
  it("sends one immediate heartbeat, shares a four-digit count, and keeps its cadence when the menu mounts", async () => {
    const app = render(<App />);
    expect(state().status).toBe("loading");
    await advance(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/presence", expect.objectContaining({
      method: "POST", credentials: "same-origin", cache: "no-store",
    }));
    expect(state()).toMatchObject({ status: "live", count: 1234 });
    await advance(20_000);
    app.rerender(<App menu />);
    expect(screen.getByTestId("mobile").textContent).toBe(screen.getByTestId("presence").textContent);
    await advance(39_999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate the initial request under Strict Mode", async () => {
    render(<StrictMode><App /></StrictMode>);
    await advance(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("jitters successful heartbeat intervals between 55 and 65 seconds", async () => {
    vi.mocked(Math.random).mockReturnValueOnce(0).mockReturnValueOnce(1);
    render(<App />);
    await advance(54_999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(64_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears timers, aborts requests, and removes listeners on unmount", async () => {
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      signal = options!.signal!;
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const app = render(<App />);
    await advance(0);
    app.unmount();
    expect(signal!.aborted).toBe(true);
    await setVisibility("hidden");
    await setVisibility("visible");
    await setOnline(false);
    await setOnline(true);
    await advance(600_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("visibility and network", () => {
  it("waits for a visible, online tab and preserves the due time through rapid hide/show changes", async () => {
    visibility = "hidden";
    online = false;
    render(<App />);
    await advance(120_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await setVisibility("visible");
    await advance(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await setOnline(true);
    await advance(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    await advance(10_000);
    await setVisibility("hidden");
    await setVisibility("visible");
    await setOnline(false);
    await setOnline(true);
    await advance(49_999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts hidden requests, ignores their late result, and never overlaps a pending request", async () => {
    let finish!: (response: Response) => void;
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url, options) => new Promise((resolve) => {
      finish = resolve;
      signal = options!.signal!;
    }));
    render(<App />);
    await advance(0);
    await setVisibility("hidden");
    expect(signal!.aborted).toBe(true);
    await setVisibility("visible");
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    await act(async () => { finish(result(999)); });
    expect(state().count).toBeNull();
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state().count).toBe(1234);
  });
});

describe("failures and freshness", () => {
  it("keeps the last count as stale after an error, then hides it at exactly two minutes", async () => {
    fetchMock.mockResolvedValueOnce(result(9));
    fetchMock.mockResolvedValue(Response.json({ success: false }, { status: 503 }));
    render(<App />);
    await advance(0);
    expect(state()).toMatchObject({ status: "live", count: 9 });
    await advance(60_000);
    expect(state()).toMatchObject({ status: "stale", count: 9 });
    await advance(59_999);
    expect(state().count).toBe(9);
    await advance(1);
    expect(state()).toMatchObject({ status: "unavailable", count: null });
  });

  it("expires successful data while hidden even when there are no further responses", async () => {
    render(<App />);
    await advance(0);
    await setVisibility("hidden");
    await advance(120_000);
    expect(state()).toMatchObject({ status: "unavailable", count: null });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("backs off 60, 120, 240, then 300 seconds, and resets after success", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Offline"))
      .mockRejectedValueOnce(new TypeError("Offline"))
      .mockRejectedValueOnce(new TypeError("Offline"))
      .mockRejectedValueOnce(new TypeError("Offline"));
    render(<App />);
    await advance(0);
    expect(state()).toMatchObject({ status: "unavailable", count: null });
    for (const [index, delay] of [60_000, 120_000, 240_000, 300_000].entries()) {
      await advance(delay - 1);
      expect(fetchMock).toHaveBeenCalledTimes(index + 1);
      await advance(1);
      expect(fetchMock).toHaveBeenCalledTimes(index + 2);
    }
    expect(state()).toMatchObject({ status: "live", count: 1234 });
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("aborts a request at ten seconds and waits sixty seconds before retrying", async () => {
    let signal: AbortSignal;
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      signal = options!.signal!;
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    render(<App />);
    await advance(9_999);
    expect(signal!.aborted).toBe(false);
    await advance(1);
    expect(signal!.aborted).toBe(true);
    expect(state()).toMatchObject({ status: "unavailable", count: null });
    await advance(59_999);
    expect(fetchMock).toHaveBeenCalledOnce();
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed successful responses instead of reporting zero users", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: { count: -1, measuredAt: "invalid" } }));
    render(<App />);
    await advance(0);
    expect(state()).toMatchObject({ status: "unavailable", count: null });
  });
});

describe("authentication lifecycle", () => {
  it("disables polling for unauthenticated and invalid sessions", async () => {
    auth.session = null;
    auth.status = "unauthenticated";
    const app = render(<App />);
    await advance(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state().status).toBe("disabled");
    auth.status = "authenticated";
    auth.session = { ...session("user-1"), error: "RefreshAccessTokenError" };
    app.rerender(<App />);
    await advance(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechecks the session only once after 401, including loading/update rerenders, until logout/login", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }));
    const app = render(<App />);
    await advance(0);
    expect(auth.update).toHaveBeenCalledOnce();
    auth.status = "loading";
    app.rerender(<App />);
    auth.status = "authenticated";
    auth.session = { ...session("user-1") };
    app.rerender(<App />);
    await setVisibility("hidden");
    await setVisibility("visible");
    await advance(600_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(auth.update).toHaveBeenCalledOnce();
    auth.session = null;
    auth.status = "unauthenticated";
    app.rerender(<App />);
    expect(state().status).toBe("disabled");
    auth.session = session("user-1");
    auth.status = "authenticated";
    app.rerender(<App />);
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state().status).toBe("live");
  });

  it("drops a previous account's delayed response and clears its displayed count", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const app = render(<App />);
    await advance(0);
    auth.session = session("user-2");
    app.rerender(<App />);
    expect(state()).toMatchObject({ status: "loading", count: null });
    await act(async () => { finish(result(999)); });
    expect(state().count).toBeNull();
    await advance(0);
    expect(state()).toMatchObject({ status: "live", count: 1234 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    auth.session = null;
    auth.status = "unauthenticated";
    app.rerender(<App />);
    await advance(600_000);
    expect(state()).toMatchObject({ status: "disabled", count: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
