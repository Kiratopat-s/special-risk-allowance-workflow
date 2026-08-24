import { describe, expect, test } from "bun:test";
import { createGoogleCalendarHolidayProvider } from "./provider";

describe("Google Calendar holiday provider", () => {
  test("uses Thai calendar Events:list parameters and follows pagination", async () => {
    const requested: URL[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requested.push(url);
      if (!url.searchParams.has("pageToken")) {
        return Response.json({
          items: [
            {
              id: "holiday-1",
              summary: "วันขึ้นปีใหม่",
              start: { date: "2026-01-01" },
            },
            {
              id: "timed-event",
              summary: "not an all-day holiday",
              start: { dateTime: "2026-01-02T09:00:00+07:00" },
            },
          ],
          nextPageToken: "next-page",
        });
      }
      return Response.json({
        items: [
          {
            id: "holiday-2",
            summary: "วันรัฐธรรมนูญ",
            start: { date: "2026-12-10" },
          },
        ],
      });
    }) as typeof fetch;

    const provider = createGoogleCalendarHolidayProvider({
      apiKey: "test-key",
      fetcher,
    });
    const entries = await provider.listYear(2026);

    expect(entries.map((item) => item.name)).toEqual([
      "วันขึ้นปีใหม่",
      "วันรัฐธรรมนูญ",
    ]);
    expect(requested).toHaveLength(2);
    expect(requested[0].pathname).toContain(
      "/calendar/v3/calendars/th.th%23holiday%40group.v.calendar.google.com/events",
    );
    expect(requested[0].searchParams.get("timeMin")).toBe(
      "2026-01-01T00:00:00+07:00",
    );
    expect(requested[0].searchParams.get("timeMax")).toBe(
      "2027-01-01T00:00:00+07:00",
    );
    expect(requested[0].searchParams.get("singleEvents")).toBe("true");
    expect(requested[0].searchParams.get("orderBy")).toBe("startTime");
    expect(requested[0].searchParams.get("timeZone")).toBe("Asia/Bangkok");
    expect(requested[0].searchParams.get("showDeleted")).toBe("false");
    expect(requested[0].searchParams.get("maxResults")).toBe("2500");
    expect(requested[1].searchParams.get("pageToken")).toBe("next-page");
  });
});
