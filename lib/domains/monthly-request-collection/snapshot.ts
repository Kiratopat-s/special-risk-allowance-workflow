import { createHash } from "node:crypto";

export interface MrcSnapshotHashDate {
  workDate: Date;
  offSiteWorkIdSnapshot: string;
  offSiteWorkRefSnapshot: string | null;
  dayType: string;
  holidayType: string;
  holidayName: string | null;
  dailyRate: number;
  weSafeCodes: string[];
}

export interface MrcSnapshotHashItem {
  expenseClaimId: string;
  claimRevisionId: string;
  materialHash: string | null;
  employeeId: string;
  firstName: string;
  lastName: string;
  positionShort: string;
  positionLevel: string | null;
  departmentId: string;
  departmentName: string;
  departmentShort: string | null;
  dayCount: number;
  amount: number;
  remark: string | null;
  dates: MrcSnapshotHashDate[];
}

export interface MrcSnapshotHashHeader {
  departmentId: string;
  collectForMonth: Date;
  batchNo: number;
  snapshotVersion: number;
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortMrcSnapshotItems<T extends MrcSnapshotHashItem>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const employeeOrder = compareStableText(a.employeeId, b.employeeId);
    if (employeeOrder !== 0) return employeeOrder;
    const nameOrder = compareStableText(
      `${a.firstName}\u0000${a.lastName}`,
      `${b.firstName}\u0000${b.lastName}`,
    );
    if (nameOrder !== 0) return nameOrder;
    return compareStableText(a.expenseClaimId, b.expenseClaimId);
  });
}

export function buildMrcSnapshotCanonicalValue(
  header: MrcSnapshotHashHeader,
  items: readonly MrcSnapshotHashItem[],
): unknown {
  return {
    header: {
      departmentId: header.departmentId,
      collectForMonth: header.collectForMonth.toISOString().slice(0, 10),
      batchNo: header.batchNo,
      snapshotVersion: header.snapshotVersion,
    },
    items: sortMrcSnapshotItems(items).map((item, index) => ({
      rowNo: index + 1,
      expenseClaimId: item.expenseClaimId,
      claimRevisionId: item.claimRevisionId,
      materialHash: item.materialHash,
      employeeId: item.employeeId,
      firstName: item.firstName,
      lastName: item.lastName,
      positionShort: item.positionShort,
      positionLevel: item.positionLevel,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      departmentShort: item.departmentShort,
      days: item.dayCount,
      amount: item.amount.toFixed(2),
      remark: item.remark,
      dates: [...item.dates]
        .sort((a, b) => {
          const dateOrder = a.workDate.getTime() - b.workDate.getTime();
          if (dateOrder !== 0) return dateOrder;
          return compareStableText(
            a.offSiteWorkIdSnapshot,
            b.offSiteWorkIdSnapshot,
          );
        })
        .map((date) => ({
          date: date.workDate.toISOString().slice(0, 10),
          offSiteWorkId: date.offSiteWorkIdSnapshot,
          offSiteWorkRef: date.offSiteWorkRefSnapshot,
          dayType: date.dayType,
          holidayType: date.holidayType,
          holidayName: date.holidayName,
          rate: date.dailyRate.toFixed(2),
          weSafeCodes: [...date.weSafeCodes].sort(compareStableText),
        })),
    })),
  };
}

export function computeMrcSnapshotHash(
  header: MrcSnapshotHashHeader,
  items: readonly MrcSnapshotHashItem[],
): string {
  return createHash("sha256")
    .update(JSON.stringify(buildMrcSnapshotCanonicalValue(header, items)))
    .digest("hex");
}
