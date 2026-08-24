import { randomUUID } from "node:crypto";
import type { Prisma } from "@/lib/generated/prisma/client";

type MonthlyRequestItemDateScalars = Omit<
  Prisma.MonthlyRequestItemDateCreateManyInput,
  "id" | "monthlyRequestItemId"
>;

export type MonthlyRequestItemDateWrite = MonthlyRequestItemDateScalars & {
  weSafeCodes: readonly string[];
};

/**
 * Persists MRC date snapshots before their We Safe children.
 *
 * Keeping these as two explicit statements avoids relying on a deep nested
 * create to order the date and code rows correctly. The caller must pass the
 * active transaction so the item, dates, and codes remain atomic.
 */
export async function createMonthlyRequestItemDates(
  tx: Prisma.TransactionClient,
  monthlyRequestItemId: string,
  dates: readonly MonthlyRequestItemDateWrite[],
): Promise<void> {
  if (dates.length === 0) return;

  const dateRows = dates.map(({ weSafeCodes, ...date }) => ({
    insert: {
      ...date,
      id: randomUUID(),
      monthlyRequestItemId,
    },
    weSafeCodes,
  }));

  await tx.monthlyRequestItemDate.createMany({
    data: dateRows.map((date) => date.insert),
  });

  const codeRows = dateRows.flatMap((date) =>
    date.weSafeCodes.map((code) => ({
      id: randomUUID(),
      monthlyRequestItemDateId: date.insert.id,
      code,
    })),
  );

  if (codeRows.length > 0) {
    await tx.monthlyRequestItemDateWeSafeCode.createMany({ data: codeRows });
  }
}
