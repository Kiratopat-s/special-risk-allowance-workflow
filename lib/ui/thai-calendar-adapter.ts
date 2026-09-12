import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import type {
  AdapterOptions,
  DateBuilderReturnType,
  PickersTimezone,
} from "@mui/x-date-pickers/models";
import dayjs from "dayjs";
import buddhistEra from "dayjs/plugin/buddhistEra";
import "dayjs/locale/th";
import { bangkokToday } from "@/lib/shared/format";
import "./picker-date";

dayjs.extend(buddhistEra);

/** Calendar-only adapter: Gregorian arithmetic, Buddhist labels, Thai civil today.
 * Parsing editable Buddhist fields is deliberately handled outside MUI's Gregorian
 * field parser. YYYY serialization and Day.js year()/setYear remain Gregorian.
 */
export class ThaiCalendarAdapter extends AdapterDayjs {
  constructor(options: AdapterOptions<string, never> = {}) {
    super(options);
    const date = this.date;
    this.date = <T extends string | null | undefined>(
      value?: T,
      timezone?: PickersTimezone,
    ): DateBuilderReturnType<T> => {
      if (value === undefined && timezone === "UTC") {
        return date(
          `${bangkokToday()}T00:00:00.000Z`,
          timezone,
        ) as DateBuilderReturnType<T>;
      }
      return date(value, timezone);
    };
    this.formats = {
      ...this.formats,
      year: "BBBB",
      fullDate: "D MMMM [พ.ศ.] BBBB",
      keyboardDate: "DD/MM/BBBB",
    };
    // Day.js constructs boundaries with Date.UTC, which maps years 0–99 to
    // 1900–1999. A Gregorian 400-year cycle preserves leap days and weekdays.
    for (const method of [
      "startOfYear",
      "endOfYear",
      "startOfMonth",
      "endOfMonth",
      "startOfWeek",
      "endOfWeek",
    ] as const) {
      const boundary = this[method];
      this[method] = (value) =>
        value.year() >= 0 && value.year() < 100
          ? boundary(value.add(400, "year")).subtract(400, "year")
          : boundary(value);
    }
  }
}
