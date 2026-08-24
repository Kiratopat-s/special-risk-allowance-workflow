import type { HolidayCalendarEntryInput } from "./types";

const DEFAULT_CALENDAR_ID = "th.th#holiday@group.v.calendar.google.com";
const GOOGLE_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars";
const BANGKOK_OFFSET = "+07:00";

export interface HolidayProvider {
  listYear(year: number): Promise<HolidayCalendarEntryInput[]>;
}

interface GoogleCalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
}

interface GoogleCalendarEventsPage {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export interface GoogleHolidayProviderOptions {
  apiKey?: string;
  accessToken?: string;
  calendarId?: string;
  fetcher?: typeof fetch;
}

function normalizeCalendarId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Google Calendar Events:list provider. Only all-day events (`start.date`) are
 * holidays; timed events are deliberately ignored.
 */
export function createGoogleCalendarHolidayProvider(
  options: GoogleHolidayProviderOptions = {},
): HolidayProvider {
  const apiKey = options.apiKey ?? process.env.GOOGLE_CALENDAR_API_KEY;
  const accessToken =
    options.accessToken ?? process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
  const calendarId = normalizeCalendarId(
    options.calendarId ??
      process.env.GOOGLE_HOLIDAY_CALENDAR_ID ??
      DEFAULT_CALENDAR_ID,
  );
  const fetcher = options.fetcher ?? fetch;

  return {
    async listYear(year: number): Promise<HolidayCalendarEntryInput[]> {
      if (!apiKey && !accessToken) {
        throw new Error("Google Calendar credentials are not configured");
      }

      const entries: HolidayCalendarEntryInput[] = [];
      let pageToken: string | undefined;

      do {
        const url = new URL(
          `${GOOGLE_EVENTS_ENDPOINT}/${encodeURIComponent(calendarId)}/events`,
        );
        url.searchParams.set("timeMin", `${year}-01-01T00:00:00${BANGKOK_OFFSET}`);
        url.searchParams.set(
          "timeMax",
          `${year + 1}-01-01T00:00:00${BANGKOK_OFFSET}`,
        );
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("timeZone", "Asia/Bangkok");
        url.searchParams.set("showDeleted", "false");
        url.searchParams.set("maxResults", "2500");
        if (apiKey) url.searchParams.set("key", apiKey);
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const response = await fetcher(url, {
          cache: "no-store",
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          throw new Error(`Google Calendar returned HTTP ${response.status}`);
        }

        const page = (await response.json()) as GoogleCalendarEventsPage;
        for (const event of page.items ?? []) {
          const value = event.start?.date;
          if (
            event.status === "cancelled" ||
            !value ||
            !event.summary ||
            Number(value.slice(0, 4)) !== year
          ) {
            continue;
          }
          entries.push({
            date: dateOnly(value),
            name: event.summary.trim(),
            sourceReference:
              event.htmlLink ??
              `google-calendar:${calendarId}:${event.id ?? value}`,
          });
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      return entries;
    },
  };
}

export const googleCalendarHolidayProvider =
  createGoogleCalendarHolidayProvider();
