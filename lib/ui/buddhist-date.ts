import {
  formatPickerDate,
  parsePickerDate,
  type PickerDateKind,
} from "./picker-date";

export const BUDDHIST_YEAR_OFFSET = 543;
export type BuddhistDateParts = { day: string; month: string; year: string };
export type BuddhistDatePart = keyof BuddhistDateParts;
export type BuddhistDateInput = {
  status: "empty" | "incomplete" | "invalid" | "valid";
  value: string;
};

export function buddhistDateParts(
  value: string,
  kind: PickerDateKind,
): BuddhistDateParts {
  const date = parsePickerDate(value, kind);
  return date
    ? {
        day: kind === "date" ? String(date.date()).padStart(2, "0") : "",
        month: String(date.month() + 1).padStart(2, "0"),
        year: String(date.year() + BUDDHIST_YEAR_OFFSET).padStart(4, "0"),
      }
    : { day: "", month: "", year: "" };
}

/** Interpret only Buddhist years. Never run calendar arithmetic on a shifted Date. */
export function parseBuddhistDateParts(
  parts: BuddhistDateParts,
  kind: PickerDateKind,
): BuddhistDateInput {
  const values =
    kind === "date"
      ? [parts.day, parts.month, parts.year]
      : [parts.month, parts.year];
  if (values.every((value) => !value)) return { status: "empty", value: "" };
  if (values.some((value) => !value) || parts.year.length < 4)
    return { status: "incomplete", value: "" };
  const year = Number(parts.year) - BUDDHIST_YEAR_OFFSET;
  if (
    !values.every((value) => /^\d+$/.test(value)) ||
    year < 1 ||
    year > 9999
  ) {
    return { status: "invalid", value: "" };
  }
  const iso = `${String(year).padStart(4, "0")}-${parts.month.padStart(2, "0")}${kind === "date" ? `-${parts.day.padStart(2, "0")}` : ""}`;
  const date = parsePickerDate(iso, kind);
  return date
    ? { status: "valid", value: formatPickerDate(date, kind) }
    : { status: "invalid", value: "" };
}

export function parseBuddhistDateText(
  text: string,
  kind: PickerDateKind,
): BuddhistDateParts | null {
  const match = text
    .trim()
    .match(
      kind === "date"
        ? /^(\d{1,2})\/(\d{1,2})\/(\d{4,5})$/
        : /^(\d{1,2})\/(\d{4,5})$/,
    );
  if (!match) return null;
  return kind === "date"
    ? { day: match[1], month: match[2], year: match[3] }
    : { day: "", month: match[1], year: match[2] };
}

export function stepBuddhistDatePart(
  parts: BuddhistDateParts,
  kind: PickerDateKind,
  part: BuddhistDatePart,
  amount: number,
): BuddhistDateParts {
  const parsed = parseBuddhistDateParts(parts, kind);
  const date = parsePickerDate(parsed.value, kind);
  if (date) {
    const next = date.add(amount, part);
    return next.year() >= 1 && next.year() <= 9999
      ? buddhistDateParts(formatPickerDate(next, kind), kind)
      : parts;
  }
  const min = part === "year" ? 544 : 1;
  const max = part === "year" ? 10542 : part === "month" ? 12 : 31;
  return {
    ...parts,
    [part]: String(
      Math.min(
        max,
        Math.max(min, Number(parts[part] || min - amount) + amount),
      ),
    ).padStart(part === "year" ? 4 : 2, "0"),
  };
}
