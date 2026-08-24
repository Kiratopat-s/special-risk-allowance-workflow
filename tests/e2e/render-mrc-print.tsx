import { renderToStaticMarkup } from "react-dom/server";
import { MrcPrintDocument } from "../../app/monthly-request-collection/[id]/print/page";
import type { MonthlyRequestCollectionWithRelations } from "../../lib/domains/monthly-request-collection/types";

const officialMrc: MonthlyRequestCollectionWithRelations = {
  id: "mrc-print-e2e",
  departmentId: "department-print-e2e",
  collectorId: "collector-print-e2e",
  collectForMonth: new Date("2026-08-01T00:00:00.000Z"),
  batchNo: 1,
  status: "FINALIZED",
  claimCount: 1,
  countDates: 2,
  amount: 300,
  snapshotVersion: 1,
  snapshotHash: "a".repeat(64),
  finalizedAt: new Date("2026-08-09T08:00:00.000Z"),
  finalizedById: "collector-print-e2e",
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
  department: {
    id: "department-print-e2e",
    name: "ฝ่ายข้อมูลปัจจุบันที่ไม่ควรใช้",
    shortName: "ฝ.ปจ.",
  },
  collector: {
    id: "collector-print-e2e",
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
      id: "mrc-item-print-e2e",
      expenseClaimId: "claim-print-e2e",
      claimRevisionId: "revision-print-e2e",
      claimRevisionNo: 2,
      addedById: "collector-print-e2e",
      addedAt: new Date("2026-08-09T07:00:00.000Z"),
      removedAt: null,
      removalReason: null,
      rowNo: 1,
      employeeIdSnapshot: "000123",
      firstNameSnapshot: "สมชาย",
      lastNameSnapshot: "ทดสอบ",
      positionShortSnapshot: "พชง.",
      positionLevelSnapshot: "5",
      departmentIdSnapshot: "department-print-e2e",
      departmentNameSnapshot: "ฝ่าย snapshot สำหรับเอกสาร",
      departmentShortSnapshot: "ฝ.สแนป",
      dayCountSnapshot: 2,
      amountSnapshot: 300,
      remarkSnapshot: "ข้อมูลจาก snapshot",
      claimStatus: "COLLECTED",
      dates: [
        {
          id: "date-print-e2e-1",
          workDate: new Date("2026-08-01T00:00:00.000Z"),
          offSiteWorkIdSnapshot: "osw-print-e2e",
          offSiteWorkRefSnapshot: "กฟก.1/2569",
          dayType: "TRAVEL",
          holidayType: "WEEKEND",
          holidayName: "วันเสาร์",
          dailyRate: 150,
          weSafeCodes: [
            { id: "code-print-e2e-1", code: "WSZ2026HZ0000017489" },
          ],
        },
        {
          id: "date-print-e2e-2",
          workDate: new Date("2026-08-12T00:00:00.000Z"),
          offSiteWorkIdSnapshot: "osw-print-e2e",
          offSiteWorkRefSnapshot: "กฟก.1/2569",
          dayType: "DUTY",
          holidayType: "PUBLIC_HOLIDAY",
          holidayName: "วันแม่แห่งชาติ",
          dailyRate: 150,
          weSafeCodes: [
            { id: "code-print-e2e-2", code: "WSZ2026HZ0000017488" },
          ],
        },
      ],
    },
  ],
};

const status = process.argv[2];
if (status !== "DRAFT" && status !== "FINALIZED") {
  throw new Error("Expected print status DRAFT or FINALIZED");
}

const mrc: MonthlyRequestCollectionWithRelations = {
  ...officialMrc,
  status,
  batchNo: status === "DRAFT" ? null : 1,
  snapshotHash: status === "DRAFT" ? null : officialMrc.snapshotHash,
  finalizedAt: status === "DRAFT" ? null : officialMrc.finalizedAt,
  finalizedById: status === "DRAFT" ? null : officialMrc.finalizedById,
};
const markup = renderToStaticMarkup(
  <MrcPrintDocument
    mrc={mrc}
    printedAt={new Date("2026-08-09T09:00:00.000Z")}
  />,
);

process.stdout.write(
  `<!doctype html><html lang="th"><head><meta charset="utf-8"></head><body>${markup}</body></html>`,
);
