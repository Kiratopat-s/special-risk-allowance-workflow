import type { HolidaySource, HolidayType } from "@/lib/shared/types";

export interface HolidayResolution {
  date: string;
  holidayType: HolidayType;
  holidayName: string | null;
  holidaySource: HolidaySource;
  /** True when the external calendar could not be resolved for this year. */
  usedFallback: boolean;
}

export interface HolidayCalendarEntryInput {
  date: Date;
  name: string;
  sourceReference: string;
}

