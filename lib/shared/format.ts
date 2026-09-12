/**
 * Shared Format Utilities
 *
 * Centralised date/number formatting helpers used across client and server UI.
 * Date-only values use UTC calendar components; timestamps use Thailand time.
 *
 * @module lib/shared/format
 */

export const THAILAND_TIME_ZONE = "Asia/Bangkok";
export type DateDisplayOptions = { timeZone?: "UTC" | "Asia/Bangkok" };

export function thaiDateFormat(
  value: Date | string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    ...options,
    calendar: "buddhist",
    numberingSystem: "latn",
  }).format(date);
}

/** Today's Thai civil date, still encoded as Gregorian ISO for application data. */
export function bangkokToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: THAILAND_TIME_ZONE,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) =>
      parts
        .find((part) => part.type === type)!
        .value.padStart(type === "year" ? 4 : 2, "0"),
    )
    .join("-");
}

export function bangkokCurrentMonth(now: Date = new Date()): string {
  return bangkokToday(now).slice(0, 7);
}

/**
 * Returns a full Thai month-year string, e.g. "มีนาคม 2568".
 */
export function monthDisplay(value: Date | string): string {
  return thaiDateFormat(value, {
    year: "numeric",
    month: "long",
  });
}

/**
 * Returns a zero-padded Thai short date, e.g. "05/03/2568".
 */
export function dateDisplay(
  value: Date | string,
  options: DateDisplayOptions = {},
): string {
  return thaiDateFormat(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  });
}

/**
 * Returns a full Thai long date, e.g. "5 มีนาคม 2568".
 * Accepts null and returns `fallback` (default "") for null/undefined.
 */
export function longDateDisplay(
  value: Date | string | null | undefined,
  fallback = "",
  options: DateDisplayOptions = {},
): string {
  if (!value) return fallback;
  return thaiDateFormat(value, {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  });
}

/**
 * Returns a Thai short date with abbreviated month name, e.g. "5 มี.ค. 2568".
 */
export function shortDateDisplay(
  value: Date | string,
  options: DateDisplayOptions = {},
): string {
  return thaiDateFormat(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/**
 * Returns a full Thai datetime string, e.g. "5 มีนาคม 2568 14:30:00".
 */
export function dateTimeDisplay(value: Date | string): string {
  return thaiDateFormat(value, {
    timeZone: THAILAND_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Converts a Date or string to an HTML `<input type="month">` value: "yyyy-MM".
 */
export function toMonthInput(value: Date | string): string {
  const date = new Date(value);
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${m}`;
}

/**
 * Converts a Date or string to an HTML `<input type="date">` value: "yyyy-MM-dd".
 */
export function toDateInputValue(value: Date | string): string {
  return new Date(value).toISOString().split("T")[0];
}

/**
 * Converts a Prisma Decimal (or any value with `.toString()`) to a display
 * string. Returns "-" for null / undefined.
 */
export function decimalText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object" && "toString" in (value as object)) {
    return String((value as { toString(): string }).toString());
  }
  return String(value);
}
