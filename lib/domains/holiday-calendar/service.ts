import { googleCalendarHolidayProvider, type HolidayProvider } from "./provider";
import { holidayCalendarRepository } from "./repository";
import type { HolidayResolution } from "./types";

const SYNC_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type HolidayRepository = typeof holidayCalendarRepository;

export interface HolidayCalendarServiceOptions {
  provider?: HolidayProvider;
  repository?: HolidayRepository;
  now?: () => Date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isoDate(utcDate(value)) === value;
}

/** Create an injectable service so provider failures/cache semantics are testable. */
export function createHolidayCalendarService(
  options: HolidayCalendarServiceOptions = {},
) {
  const provider = options.provider ?? googleCalendarHolidayProvider;
  const repository = options.repository ?? holidayCalendarRepository;
  const now = options.now ?? (() => new Date());

  async function ensureYearCache(year: number): Promise<boolean> {
    const existing = await repository.findSync(year);
    const hasCompleteCache = Boolean(existing?.lastSuccessAt);
    if (
      existing?.lastSuccessAt &&
      now().getTime() - existing.lastSuccessAt.getTime() < SYNC_TTL_MS
    ) {
      return true;
    }

    try {
      const entries = await provider.listYear(year);
      // An empty list is still a valid full-year snapshot: absence means workday.
      await repository.saveGoogleYear(year, entries);
      return true;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unknown holiday sync error";
      await repository.recordGoogleFailure(year, message);
      // A stale but complete full-year cache is authoritative when refresh fails.
      return hasCompleteCache;
    }
  }

  return {
    async resolveDates(values: string[]): Promise<Map<string, HolidayResolution>> {
      const uniqueDates = [...new Set(values)].sort();
      if (uniqueDates.some((value) => !isIsoDate(value))) {
        throw new Error("Holiday dates must use YYYY-MM-DD");
      }
      const years = [...new Set(uniqueDates.map((value) => Number(value.slice(0, 4))))];
      const cacheComplete = new Map<number, boolean>();

      await Promise.all(
        years.map(async (year) => {
          cacheComplete.set(year, await ensureYearCache(year));
        }),
      );

      const stored = await repository.findByDates(uniqueDates.map(utcDate));
      const storedByDate = new Map(stored.map((item) => [isoDate(item.date), item]));
      const resolutions = new Map<string, HolidayResolution>();

      for (const value of uniqueDates) {
        const date = utcDate(value);
        const holiday = storedByDate.get(value);
        // Preserve the official holiday name/source even when it falls on a weekend.
        if (holiday) {
          resolutions.set(value, {
            date: value,
            holidayType: "PUBLIC_HOLIDAY",
            holidayName: holiday.name,
            holidaySource: holiday.source,
            usedFallback: false,
          });
          continue;
        }

        const day = date.getUTCDay();
        if (day === 0 || day === 6) {
          resolutions.set(value, {
            date: value,
            holidayType: "WEEKEND",
            holidayName: day === 0 ? "วันอาทิตย์" : "วันเสาร์",
            holidaySource: "CALCULATED",
            usedFallback: false,
          });
          continue;
        }

        const year = Number(value.slice(0, 4));
        const hasCache = cacheComplete.get(year) === true;
        resolutions.set(value, {
          date: value,
          holidayType: hasCache ? "WORKDAY" : "FALLBACK_WORKDAY",
          holidayName: null,
          holidaySource: hasCache ? "GOOGLE" : "FALLBACK",
          usedFallback: !hasCache,
        });
      }

      return resolutions;
    },
  };
}

export const holidayCalendarService = createHolidayCalendarService();
