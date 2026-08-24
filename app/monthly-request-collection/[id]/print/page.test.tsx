import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MrcPrintDocument, paginate } from "./page";

const snapshot = {
  id: "mrc-print-test",
  departmentId: "dept-1",
  collectorId: "collector-1",
  collectForMonth: new Date("2026-08-01T00:00:00.000Z"),
  batchNo: 1,
  status: "FINALIZED",
  claimCount: 1,
  countDates: 1,
  amount: 150,
  snapshotVersion: 1,
  snapshotHash: "a".repeat(64),
  finalizedAt: new Date("2026-08-09T08:00:00.000Z"),
  finalizedById: "collector-1",
  paperApprovedAt: null,
  allDoneNote: null,
  allDoneAt: null,
  allDoneById: null,
  cancelledAt: null,
  cancelledById: null,
  cancelReason: null,
  voidedAt: null,
  voidedById: null,
  voidReason: null,
  createdAt: new Date("2026-08-09T07:00:00.000Z"),
  updatedAt: new Date("2026-08-09T08:00:00.000Z"),
  department: { id: "dept-1", name: "ฝ่ายทดสอบ", shortName: "ฝทส." },
  collector: {
    id: "collector-1",
    firstName: "ผู้รวบรวม",
    lastName: "ทดสอบ",
    employeeId: "999999",
  },
  finalizedBy: null,
  allDoneBy: null,
  cancelledBy: null,
  voidedBy: null,
  replacementSources: [],
  items: [
    {
      id: "item-1",
      expenseClaimId: "claim-1",
      claimRevisionId: "revision-1",
      claimRevisionNo: 1,
      addedById: "collector-1",
      addedAt: new Date("2026-08-09T07:00:00.000Z"),
      removedAt: null,
      removalReason: null,
      rowNo: 1,
      employeeIdSnapshot: "000123",
      firstNameSnapshot: "สมชาย",
      lastNameSnapshot: "ทดสอบ",
      positionShortSnapshot: "พชง.",
      positionLevelSnapshot: "5",
      departmentIdSnapshot: "dept-1",
      departmentNameSnapshot: "ฝ่ายทดสอบ",
      departmentShortSnapshot: "ฝทส.",
      dayCountSnapshot: 1,
      amountSnapshot: 150,
      remarkSnapshot: null,
      claimStatus: "COLLECTED",
      dates: [
        {
          id: "date-1",
          workDate: new Date("2026-08-01T00:00:00.000Z"),
          offSiteWorkIdSnapshot: "osw-1",
          offSiteWorkRefSnapshot: "กฟก.1/2569",
          dayType: "TRAVEL",
          holidayType: "WEEKEND",
          holidayName: "วันเสาร์",
          dailyRate: 150,
          weSafeCodes: [
            { id: "code-1", code: "WSZ2026HZ0000017489" },
          ],
        },
      ],
    },
  ],
};

function render(status: "FINALIZED" | "DRAFT"): string {
  return renderToStaticMarkup(
    <MrcPrintDocument
      mrc={{
        ...snapshot,
        status,
        batchNo: status === "DRAFT" ? null : 1,
        snapshotHash: status === "DRAFT" ? null : "a".repeat(64),
      } as never}
      printedAt={new Date("2026-08-09T09:00:00.000Z")}
    />,
  );
}

describe("MRC print pagination", () => {
  test("balances regular pages while reserving room for the final signature", () => {
    const pages = paginate(
      Array.from({ length: 31 }, (_, index) => index + 1),
      19,
      11,
    );
    expect(pages.map((page) => page.rows.length)).toEqual([10, 10, 11]);
    expect(pages.map((page) => page.offset)).toEqual([0, 10, 20]);
    expect(pages.map((page) => page.isLast)).toEqual([false, false, true]);
  });
});

describe("MRC paper document", () => {
  test("renders one physical signature block and a separate date appendix", () => {
    const html = render("FINALIZED");
    expect((html.match(/class="signature"/g) ?? []).length).toBe(1);
    expect(html).toContain("หผ.");
    expect(html).toContain("ภาคผนวกวันปฏิบัติงานและเลขรหัส WeSafe");
    expect(html).toContain("WSZ2026HZ0000017489");
    expect(html).not.toContain('class="watermark"');
    expect(html).toContain("@page { size: A4 portrait");
  });

  test("puts the draft watermark on every generated sheet", () => {
    const html = render("DRAFT");
    const sheetCount = (html.match(/class="sheet"/g) ?? []).length;
    const watermarkCount = (html.match(/class="watermark"/g) ?? []).length;
    expect(sheetCount).toBe(2);
    expect(watermarkCount).toBe(sheetCount);
    expect(html).toContain("ฉบับร่าง · ใช้ตรวจสอบเท่านั้น");
  });
});
