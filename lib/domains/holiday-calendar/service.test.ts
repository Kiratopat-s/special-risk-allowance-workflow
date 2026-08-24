import { describe, expect, test } from "bun:test";
import type { HolidaySource } from "@/lib/shared/types";
import type { HolidayProvider } from "./provider";
import { createHolidayCalendarService } from "./service";
import { holidayCalendarRepository } from "./repository";

type StoredHoliday = Awaited<
  ReturnType<typeof holidayCalendarRepository.findByDates>
>[number];
type StoredSync = Awaited<ReturnType<typeof holidayCalendarRepository.findSync>>;

function fakeRepository(options: {
  sync: StoredSync;
  dates?: StoredHoliday[];
}) {
  return {
    findSync: async () => options.sync,
    findByDates: async () => options.dates ?? [],
    saveGoogleYear: async () => undefined,
    recordGoogleFailure: async () => undefined,
  } as unknown as typeof holidayCalendarRepository;
}

const failingProvider: HolidayProvider = {
  listYear: async () => {
    throw new Error("provider unavailable");
  },
};

describe("holiday cache and fallback semantics", () => {
  test("uses fallback only when provider fails and no full-year cache exists", async () => {
    const service = createHolidayCalendarService({
      provider: failingProvider,
      repository: fakeRepository({ sync: null }),
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });
    const result = await service.resolveDates(["2026-08-10"]);
    expect(result.get("2026-08-10")).toMatchObject({
      holidayType: "FALLBACK_WORKDAY",
      holidaySource: "FALLBACK",
      usedFallback: true,
    });
  });

  test("keeps using a stale complete cache when refresh fails", async () => {
    const service = createHolidayCalendarService({
      provider: failingProvider,
      repository: fakeRepository({
        sync: {
          id: "sync",
          year: 2026,
          provider: "GOOGLE" as HolidaySource,
          status: "FAILED",
          lastAttemptAt: new Date("2026-01-01T00:00:00.000Z"),
          lastSuccessAt: new Date("2025-01-01T00:00:00.000Z"),
          errorMessage: "old failure",
        },
      }),
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });
    const result = await service.resolveDates(["2026-08-10"]);
    expect(result.get("2026-08-10")).toMatchObject({
      holidayType: "WORKDAY",
      holidaySource: "GOOGLE",
      usedFallback: false,
    });
  });

  test("public holiday metadata wins when the holiday falls on a weekend", async () => {
    const publicHoliday: StoredHoliday = {
      date: new Date("2026-08-08T00:00:00.000Z"),
      name: "วันหยุดพิเศษ",
      source: "GOOGLE",
      sourceReference: "event",
      fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const service = createHolidayCalendarService({
      provider: failingProvider,
      repository: fakeRepository({
        sync: {
          id: "sync",
          year: 2026,
          provider: "GOOGLE",
          status: "SUCCESS",
          lastAttemptAt: new Date("2026-08-01T00:00:00.000Z"),
          lastSuccessAt: new Date("2026-08-01T00:00:00.000Z"),
          errorMessage: null,
        },
        dates: [publicHoliday],
      }),
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });
    const result = await service.resolveDates(["2026-08-08"]);
    expect(result.get("2026-08-08")).toMatchObject({
      holidayType: "PUBLIC_HOLIDAY",
      holidayName: "วันหยุดพิเศษ",
      holidaySource: "GOOGLE",
    });
  });

  test("marks a computed weekend separately from manual calendar data", async () => {
    const service = createHolidayCalendarService({
      provider: failingProvider,
      repository: fakeRepository({ sync: null }),
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });
    const result = await service.resolveDates(["2026-08-09"]);
    expect(result.get("2026-08-09")).toMatchObject({
      holidayType: "WEEKEND",
      holidayName: "วันอาทิตย์",
      holidaySource: "CALCULATED",
      usedFallback: false,
    });
  });
});
