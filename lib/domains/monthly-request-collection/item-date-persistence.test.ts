import { describe, expect, test } from "bun:test";
import type { Prisma } from "@/lib/generated/prisma/client";
import { createMonthlyRequestItemDates } from "./item-date-persistence";

describe("createMonthlyRequestItemDates", () => {
  test("creates parent dates before codes and links every code to a created date", async () => {
    const calls: string[] = [];
    let dateRows: Prisma.MonthlyRequestItemDateCreateManyInput[] = [];
    let codeRows: Prisma.MonthlyRequestItemDateWeSafeCodeCreateManyInput[] = [];
    const tx = {
      monthlyRequestItemDate: {
        createMany: async (args: {
          data: Prisma.MonthlyRequestItemDateCreateManyInput[];
        }) => {
          calls.push("dates");
          dateRows = args.data;
          return { count: args.data.length };
        },
      },
      monthlyRequestItemDateWeSafeCode: {
        createMany: async (args: {
          data: Prisma.MonthlyRequestItemDateWeSafeCodeCreateManyInput[];
        }) => {
          calls.push("codes");
          codeRows = args.data;
          return { count: args.data.length };
        },
      },
    } as unknown as Prisma.TransactionClient;

    await createMonthlyRequestItemDates(tx, "mrc-item-1", [
      {
        workDate: new Date("2026-08-01T00:00:00.000Z"),
        offSiteWorkIdSnapshot: "osw-1",
        offSiteWorkRefSnapshot: "REF-1",
        dayType: "TRAVEL",
        holidayType: "WEEKEND",
        holidayName: "วันเสาร์",
        dailyRate: 150,
        weSafeCodes: ["WSZ2026HZ0000017489", "WSZ2026HZ0000017489"],
      },
      {
        workDate: new Date("2026-08-03T00:00:00.000Z"),
        offSiteWorkIdSnapshot: "osw-1",
        offSiteWorkRefSnapshot: "REF-1",
        dayType: "DUTY",
        holidayType: "WORKDAY",
        holidayName: null,
        dailyRate: 150,
        weSafeCodes: [],
      },
    ]);

    expect(calls).toEqual(["dates", "codes"]);
    expect(dateRows).toHaveLength(2);
    expect(dateRows.every((row) => row.monthlyRequestItemId === "mrc-item-1")).toBe(
      true,
    );
    expect(new Set(dateRows.map((row) => row.id)).size).toBe(2);
    expect(codeRows).toHaveLength(2);
    expect(codeRows.map((row) => row.code)).toEqual([
      "WSZ2026HZ0000017489",
      "WSZ2026HZ0000017489",
    ]);
    expect(
      codeRows.every((row) =>
        dateRows.some((date) => date.id === row.monthlyRequestItemDateId),
      ),
    ).toBe(true);
  });

  test("does not issue database writes for an empty date list", async () => {
    const tx = {
      monthlyRequestItemDate: {
        createMany: () => {
          throw new Error("unexpected date write");
        },
      },
      monthlyRequestItemDateWeSafeCode: {
        createMany: () => {
          throw new Error("unexpected code write");
        },
      },
    } as unknown as Prisma.TransactionClient;

    await expect(createMonthlyRequestItemDates(tx, "mrc-item-1", [])).resolves.toBe(
      undefined,
    );
  });
});
