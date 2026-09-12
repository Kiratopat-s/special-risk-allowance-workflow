import { afterEach, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: query } }));
import { GET } from "@/app/api/health/route";

afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

it("reports readiness after checking notification columns without reading rows", async () => {
  query.mockResolvedValue([]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(query.mock.calls[0][0].join("")).toBe(
    'SELECT "is_deleted", "deleted_at" FROM "notifications" LIMIT 0',
  );
});

it.each(["missing notification column", "database connection failed"])(
  "returns an opaque unavailable response for %s",
  async (message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValue(new Error(message));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  },
);
