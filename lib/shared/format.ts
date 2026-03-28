/**
 * Shared Format Utilities
 *
 * Centralised date/number formatting helpers used across client and server UI.
 * All Thai locale outputs use "th-TH" to produce Buddhist-era years.
 *
 * @module lib/shared/format
 */

/**
 * Returns a full Thai month-year string, e.g. "มีนาคม 2568".
 */
export function monthDisplay(value: Date | string): string {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
    });
}

/**
 * Returns a zero-padded Thai short date, e.g. "05/03/2568".
 */
export function dateDisplay(value: Date | string): string {
    return new Date(value).toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * Returns a full Thai long date, e.g. "5 มีนาคม 2568".
 * Accepts null and returns `fallback` (default "") for null/undefined.
 */
export function longDateDisplay(
    value: Date | string | null | undefined,
    fallback = "",
): string {
    if (!value) return fallback;
    return new Date(value).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

/**
 * Returns a Thai short date with abbreviated month name, e.g. "5 มี.ค. 2568".
 */
export function shortDateDisplay(value: Date | string): string {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/**
 * Returns a full Thai datetime string, e.g. "5 มีนาคม 2568 14:30:00".
 */
export function dateTimeDisplay(value: Date | string): string {
    return new Date(value).toLocaleString("th-TH", {
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
    return `${y}-${m}`;
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
