import { describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { toClaimPrintDocument, type ClaimPrintSource, claimPrintSelect } from "./print-data";

function source(overrides: Partial<ClaimPrintSource> = {}): ClaimPrintSource {
  return {
    id: "claim-a", expenseMonth: new Date("2026-07-01Z"), status: "DRAFT",
    claimant: { firstName: "ชื่อ", lastName: "สกุล", employeeId: "123" },
    claimantPositionAtSubmission: "ตำแหน่ง ณ ยื่น", selectedDates: ["2026-07-01"], countDates: new Prisma.Decimal(1), remark: "หมายเหตุเดิม",
    expenseClaimOffSiteWorks: [{ offSiteWork: {
      id: "TZ001", innerRefDocumentId: "REF001", startDate: new Date("2026-06-26Z"), endDate: new Date("2026-07-03Z"),
      location: "สถานที่", leaderFirstName: "หัวหน้า", leaderLastName: "หนึ่ง", leaderPosition: "ตำแหน่งหัวหน้า", leaderUser: { department: { shortName: "กอง", name: "กองทดสอบ" } },
    } }],
    leaderVerifications: [], ...overrides,
  };
}

describe("claim print data", () => {
  it("uses stored claimant position, TZ number, original cross-month range and references", () => {
    const doc = toClaimPrintDocument(source());
    expect(doc.claimantPosition).toBe("ตำแหน่ง ณ ยื่น");
    expect(doc.orders[0]).toMatchObject({ id: "TZ001", period: "26 มิ.ย. 2569 - 3 ก.ค. 2569", leaderDepartment: "กอง" });
    expect(doc.notes).toEqual(["หมายเหตุเดิม", "เลขอ้างอิงภายใน: REF001"]);
    expect(doc.month).toBe("2026-07");
    expect(doc.buddhistYear).toBe("2569");
  });
  it.each([["2024-02", 29], ["2026-02", 28], ["2026-04", 30], ["2026-07", 31]])("marks only real calendar days in %s", (month, days) => {
    const doc = toClaimPrintDocument(source({ expenseMonth: new Date(`${month}-01Z`), selectedDates: [`${month}-${days}`, `${month}-31`, "2025-01-01", "bad"] }));
    expect(doc.daysInMonth).toBe(days);
    expect(doc.selectedDays).toEqual([days]);
    expect(doc.warnings.some((w) => w.includes("ไม่ถูกต้อง"))).toBe(true);
  });
  it("deduplicates marks without silently rewriting the stored total", () => {
    const doc = toClaimPrintDocument(source({ selectedDates: ["2026-07-01", "2026-07-01"], countDates: new Prisma.Decimal(9) }));
    expect(doc.selectedDays).toEqual([1]);
    expect(doc.countDates).toBe("9");
    expect(doc.warnings.some((w) => w.includes("ซ้ำ"))).toBe(true);
    expect(doc.warnings.some((w) => w.includes("ไม่ตรง"))).toBe(true);
  });
  it("keeps legacy dates blank rather than reconstructing them from an order", () => {
    const doc = toClaimPrintDocument(source({ selectedDates: null, countDates: new Prisma.Decimal(11) }));
    expect(doc.selectedDays).toEqual([]);
    expect(doc.countDates).toBe("11");
    expect(doc.warnings.some((w) => w.includes("ไม่มีวันที่"))).toBe(true);
  });
  it("only uses a verified signature for the exact claim and order pair", () => {
    const record = { expenseClaimId: "claim-a", offSiteWorkId: "TZ001", verifiedAt: new Date(), signatureData: Buffer.from("recorded-png") };
    const current = source({ leaderVerifications: [record] });
    expect(toClaimPrintDocument(current).orders[0].signatureUrl).toBe("data:image/png;base64,cmVjb3JkZWQtcG5n");
    for (const change of [{ expenseClaimId: "other" }, { offSiteWorkId: "other" }, { verifiedAt: null }, { signatureData: null }]) {
      expect(toClaimPrintDocument(source({ leaderVerifications: [{ ...record, ...change }] })).orders[0].signatureUrl).toBeNull();
    }
    expect(JSON.stringify(claimPrintSelect)).not.toContain('"signatures"');
    expect(JSON.stringify(claimPrintSelect)).not.toContain('"token"');
    expect(JSON.stringify(claimPrintSelect)).not.toContain('"email"');
  });
  it("warns about missing external department and preserves empty orders", () => {
    const data = source();
    data.expenseClaimOffSiteWorks[0].offSiteWork.leaderUser = null;
    expect(toClaimPrintDocument(data).warnings).toContain("TZ001: ไม่มีสังกัดผู้ควบคุม");
    expect(toClaimPrintDocument(source({ expenseClaimOffSiteWorks: [] })).orders).toEqual([]);
  });
});
