import type { MonthlyRequestStatus } from "@/lib/generated/prisma/client";
import { APP_TIME_ZONE } from "@/lib/shared/format";

export const MRC_TRANSITIONS: Readonly<
  Record<MonthlyRequestStatus, readonly MonthlyRequestStatus[]>
> = {
  DRAFT: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["ALL_DONE", "VOIDED"],
  ALL_DONE: ["VOIDED"],
  CANCELLED: [],
  VOIDED: [],
};

export interface MrcPolicyFailure {
  valid: false;
  code: string;
  message: string;
}

export interface MrcPolicySuccess<T> {
  valid: true;
  value: T;
}

export type MrcPolicyResult<T> = MrcPolicySuccess<T> | MrcPolicyFailure;

export function validateMrcTransition(
  current: MonthlyRequestStatus,
  next: MonthlyRequestStatus,
): MrcPolicyResult<MonthlyRequestStatus> {
  if (current === next) return { valid: true, value: next };
  if (MRC_TRANSITIONS[current].includes(next)) {
    return { valid: true, value: next };
  }
  return {
    valid: false,
    code: "INVALID_MRC_TRANSITION",
    message: `Monthly request cannot transition from ${current} to ${next}`,
  };
}

export function parseBangkokDateTime(value: Date | string): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const localMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (localMatch) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] =
      localMatch;
    // Asia/Bangkok is UTC+07:00 and has no daylight-saving transitions.
    if (APP_TIME_ZONE !== "Asia/Bangkok") {
      throw new RangeError("Unsupported application time zone");
    }
    const components = {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    };
    if (
      components.month < 1 ||
      components.month > 12 ||
      components.day < 1 ||
      components.day > 31 ||
      components.hour < 0 ||
      components.hour > 23 ||
      components.minute < 0 ||
      components.minute > 59 ||
      components.second < 0 ||
      components.second > 59
    ) {
      return new Date(Number.NaN);
    }
    const parsed = new Date(
      Date.UTC(
        components.year,
        components.month - 1,
        components.day,
        components.hour - 7,
        components.minute,
        components.second,
      ),
    );
    const roundTrip = new Date(parsed.getTime() + 7 * 60 * 60 * 1000);
    if (
      roundTrip.getUTCFullYear() !== components.year ||
      roundTrip.getUTCMonth() !== components.month - 1 ||
      roundTrip.getUTCDate() !== components.day ||
      roundTrip.getUTCHours() !== components.hour ||
      roundTrip.getUTCMinutes() !== components.minute ||
      roundTrip.getUTCSeconds() !== components.second
    ) {
      return new Date(Number.NaN);
    }
    return parsed;
  }
  return new Date(value);
}

export function validatePaperApprovalDate(
  value: Date | string,
  options: { now?: Date; finalizedAt?: Date | null } = {},
): MrcPolicyResult<Date> {
  const approvedAt = parseBangkokDateTime(value);
  if (Number.isNaN(approvedAt.getTime())) {
    return {
      valid: false,
      code: "INVALID_APPROVAL_DATE",
      message: "Paper approval date is invalid",
    };
  }

  const now = options.now ?? new Date();
  if (approvedAt.getTime() > now.getTime()) {
    return {
      valid: false,
      code: "APPROVAL_DATE_IN_FUTURE",
      message: "Paper approval date cannot be in the future",
    };
  }

  if (
    options.finalizedAt &&
    approvedAt.getTime() < options.finalizedAt.getTime()
  ) {
    return {
      valid: false,
      code: "APPROVAL_DATE_BEFORE_FINALIZED",
      message: "Paper approval date cannot be before the monthly request was finalized",
    };
  }

  return { valid: true, value: approvedAt };
}
