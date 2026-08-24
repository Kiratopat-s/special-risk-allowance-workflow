import { describe, expect, test } from "bun:test";
import {
  buildMrcSnapshotCanonicalValue,
  computeMrcSnapshotHash,
  type MrcSnapshotHashHeader,
  type MrcSnapshotHashItem,
} from "./snapshot";

const header: MrcSnapshotHashHeader = {
  departmentId: "dept-1",
  collectForMonth: new Date("2026-08-01T00:00:00.000Z"),
  batchNo: 2,
  snapshotVersion: 1,
};

function item(
  expenseClaimId: string,
  employeeId: string,
  day: number,
): MrcSnapshotHashItem {
  return {
    expenseClaimId,
    claimRevisionId: `revision-${expenseClaimId}`,
    materialHash: `material-${expenseClaimId}`,
    employeeId,
    firstName: `ชื่อ${employeeId}`,
    lastName: "ทดสอบ",
    positionShort: "พชง.",
    positionLevel: "5",
    departmentId: "dept-1",
    departmentName: "ฝ่ายทดสอบ",
    departmentShort: "ฝทส.",
    dayCount: 1,
    amount: 150,
    remark: null,
    dates: [
      {
        workDate: new Date(Date.UTC(2026, 7, day)),
        offSiteWorkIdSnapshot: `osw-${day}`,
        offSiteWorkRefSnapshot: `ref-${day}`,
        dayType: "HOLIDAY",
        holidayType: "PUBLIC_HOLIDAY",
        holidayName: "วันหยุดทดสอบ",
        dailyRate: 150,
        weSafeCodes: ["WS-B", "WS-A"],
      },
    ],
  };
}

describe("MRC snapshot hashing", () => {
  test("has stable item and WeSafe-code ordering", () => {
    const a = item("claim-a", "000002", 9);
    const b = item("claim-b", "000001", 8);
    const first = computeMrcSnapshotHash(header, [a, b]);
    const reversed = computeMrcSnapshotHash(header, [
      { ...b, dates: [{ ...b.dates[0], weSafeCodes: ["WS-A", "WS-B"] }] },
      a,
    ]);
    expect(reversed).toBe(first);
    const canonical = buildMrcSnapshotCanonicalValue(header, [a, b]) as {
      items: Array<{ expenseClaimId: string }>;
    };
    expect(canonical.items.map((row) => row.expenseClaimId)).toEqual([
      "claim-b",
      "claim-a",
    ]);
  });

  test("binds hash to department/month/batch/version header", () => {
    const rows = [item("claim-a", "000001", 8)];
    const original = computeMrcSnapshotHash(header, rows);
    expect(computeMrcSnapshotHash({ ...header, batchNo: 3 }, rows)).not.toBe(
      original,
    );
    expect(
      computeMrcSnapshotHash({ ...header, departmentId: "dept-2" }, rows),
    ).not.toBe(original);
  });

  test("changes when copied snapshot values change", () => {
    const original = item("claim-a", "000001", 8);
    const changed = { ...original, remark: "ข้อมูลแก้ไข" };
    expect(computeMrcSnapshotHash(header, [changed])).not.toBe(
      computeMrcSnapshotHash(header, [original]),
    );
  });
});

