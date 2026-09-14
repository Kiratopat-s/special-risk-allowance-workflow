import type { Prisma } from "@/lib/generated/prisma/client";
import { shortDateDisplay, thaiDateFormat, toMonthInput } from "@/lib/shared/format";
import type { ClaimPrintDocument } from "@/lib/shared/types/claim-print";

/** Explicit selection prevents tokens, emails and unrelated signatures reaching print views. */
export const claimPrintSelect = {
  id: true,
  expenseMonth: true,
  claimantPositionAtSubmission: true,
  selectedDates: true,
  countDates: true,
  status: true,
  remark: true,
  claimant: { select: { firstName: true, lastName: true, employeeId: true } },
  expenseClaimOffSiteWorks: {
    select: {
      offSiteWork: {
        select: {
          id: true,
          innerRefDocumentId: true,
          startDate: true,
          endDate: true,
          location: true,
          leaderFirstName: true,
          leaderLastName: true,
          leaderPosition: true,
          leaderUser: { select: { department: { select: { shortName: true, name: true } } } },
        },
      },
    },
  },
  leaderVerifications: {
    select: { expenseClaimId: true, offSiteWorkId: true, verifiedAt: true, signatureData: true },
  },
} satisfies Prisma.ExpenseClaimSelect;

export type ClaimPrintSource = Prisma.ExpenseClaimGetPayload<{ select: typeof claimPrintSelect }>;

const statuses: Record<ClaimPrintSource["status"], string> = {
  DRAFT: "ฉบับร่าง",
  PENDING: "รอดำเนินการ",
  PENDING_LEADER_VERIFY: "รอหัวหน้างานยืนยัน",
  WAIT_FOR_COLLECTION: "รอรวบรวม",
  COLLECTED: "รวบรวมแล้ว",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};

export function toClaimPrintDocument(source: ClaimPrintSource): ClaimPrintDocument {
  const warnings: string[] = [];
  const month = toMonthInput(source.expenseMonth);
  const daysInMonth = new Date(Date.UTC(
    source.expenseMonth.getUTCFullYear(), source.expenseMonth.getUTCMonth() + 1, 0,
  )).getUTCDate();
  const rawDates = Array.isArray(source.selectedDates) ? source.selectedDates : [];
  const validDates = rawDates.filter((date): date is string => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const day = Number(date.slice(8));
    return date.slice(0, 7) === month && day >= 1 && day <= daysInMonth;
  });
  const selectedDays = [...new Set(validDates.map((date) => Number(date.slice(8))))].sort((a, b) => a - b);
  if (!rawDates.length) warnings.push("ไม่มีวันที่เบิกที่บันทึกไว้ ช่องวันที่จึงเว้นว่าง");
  if (rawDates.length !== validDates.length) warnings.push("มีวันที่ไม่ถูกต้องหรืออยู่นอกเดือนเบิก จึงไม่ทำเครื่องหมายวันที่เหล่านั้น");
  if (validDates.length !== selectedDays.length) warnings.push("มีวันที่เบิกซ้ำ แสดงเครื่องหมายเพียงครั้งเดียวต่อวัน");
  const countDates = source.countDates?.toString() ?? "";
  if (!countDates) warnings.push("ไม่มีจำนวนวันที่บันทึกไว้");
  else if (Number(countDates) !== selectedDays.length) warnings.push("จำนวนวันที่บันทึกไว้ไม่ตรงกับจำนวนวันที่ทำเครื่องหมาย กรุณาตรวจสอบข้อมูลคำขอ");
  if (!source.claimant.employeeId) warnings.push("ไม่มีรหัสพนักงาน");
  if (!source.claimantPositionAtSubmission) warnings.push("ไม่มีตำแหน่งผู้เบิก ณ ตอนยื่นคำขอ");

  const works = source.expenseClaimOffSiteWorks.map((link) => link.offSiteWork).sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime() || a.id.localeCompare(b.id),
  );
  if (!works.length) warnings.push("ไม่มีคำสั่งปฏิบัติงานที่ผูกกับคำขอ");
  const orders = works.map((work) => {
    const leaderName = [work.leaderFirstName, work.leaderLastName].filter(Boolean).join(" ");
    const department = work.leaderUser?.department;
    const leaderDepartment = department?.shortName || department?.name || "";
    const verification = source.leaderVerifications.find(
      (record) => record.expenseClaimId === source.id && record.offSiteWorkId === work.id,
    );
    const bytes = verification?.verifiedAt ? verification.signatureData : null;
    if (!work.location) warnings.push(`${work.id}: ไม่มีสถานที่ปฏิบัติงาน`);
    if (!leaderName) warnings.push(`${work.id}: ไม่มีชื่อผู้ควบคุม`);
    if (!work.leaderPosition) warnings.push(`${work.id}: ไม่มีตำแหน่งผู้ควบคุม`);
    if (!leaderDepartment) warnings.push(`${work.id}: ไม่มีสังกัดผู้ควบคุม`);
    if (!verification?.verifiedAt) warnings.push(`${work.id}: ผู้ควบคุมยังไม่ได้รับรอง`);
    else if (!bytes?.length) warnings.push(`${work.id}: รับรองแล้วแต่ไม่มีภาพลายเซ็นที่บันทึกไว้`);
    return {
      id: work.id,
      location: work.location ?? "",
      period: `${shortDateDisplay(work.startDate)} - ${shortDateDisplay(work.endDate)}`,
      leaderName,
      leaderPosition: work.leaderPosition ?? "",
      leaderDepartment,
      signatureUrl: bytes?.length ? `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` : null,
    };
  });
  const references = [...new Set(works.map((work) => work.innerRefDocumentId?.trim()).filter(Boolean))];
  return {
    id: source.id,
    employeeId: source.claimant.employeeId ?? "",
    claimantName: [source.claimant.firstName, source.claimant.lastName].filter(Boolean).join(" "),
    claimantPosition: source.claimantPositionAtSubmission,
    month,
    monthName: thaiDateFormat(source.expenseMonth, { month: "long" }),
    buddhistYear: String(source.expenseMonth.getUTCFullYear() + 543),
    daysInMonth,
    selectedDays,
    countDates,
    status: statuses[source.status],
    approved: source.status === "APPROVED",
    orders,
    notes: [source.remark ?? "", ...references.map((ref) => `เลขอ้างอิงภายใน: ${ref}`)].filter(Boolean),
    warnings,
  };
}
