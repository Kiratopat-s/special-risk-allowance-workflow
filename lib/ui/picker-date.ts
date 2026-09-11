import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
export type PickerDateKind = "date" | "month";

/** Parse date-only strings in UTC, rejecting rollover instead of normalizing it. */
export function parsePickerDate(
  value: string,
  kind: PickerDateKind,
): Dayjs | null {
  const pattern =
    kind === "month"
      ? /^\d{4}-(0[1-9]|1[0-2])$/
      : /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;
  if (!pattern.test(value) || value.startsWith("0000")) return null;
  const parsed = dayjs.utc(
    `${value}${kind === "month" ? "-01" : ""}T00:00:00.000Z`,
  );
  return parsed.isValid() && formatPickerDate(parsed, kind) === value
    ? parsed
    : null;
}

export function formatPickerDate(
  value: Dayjs | null,
  kind: PickerDateKind,
): string {
  if (!value?.isValid()) return "";
  return value.format(kind === "month" ? "YYYY-MM" : "YYYY-MM-DD");
}

// Avoid MUI's implicit 1900–2099 restriction for the existing four-digit ISO fields.
export const MIN_PICKER_DATE = parsePickerDate("0001-01-01", "date")!;
export const MAX_PICKER_DATE = parsePickerDate("9999-12-31", "date")!;
