import type {
  LeaderClaimDetail,
  LeaderVerificationQueueItem,
} from "@/lib/domains/leader-verification";

export const leaderQueueSignature =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

const claimant = {
  id: "claimant-fixture-1",
  firstName: "ผู้ยื่นทดสอบ",
  lastName: "คนแรก",
  employeeId: "EMP-FIXTURE-1",
};
const firstWork = {
  id: "work-fixture-1",
  innerRefDocumentId: "ทดสอบ 001/2569",
  startDate: new Date("2026-09-03T00:00:00Z"),
  endDate: new Date("2026-09-05T00:00:00Z"),
  location: "พื้นที่ทดสอบหนึ่ง",
  objective: "ตรวจสอบระบบในพื้นที่ทดสอบ",
  leaderFirstName: "หัวหน้าทดสอบ",
  leaderLastName: "คนเดียว",
  leaderPosition: "หัวหน้าชุด",
  leaderEmpId: "LEADER-FIXTURE",
};
const secondWork = {
  ...firstWork,
  id: "work-fixture-2",
  innerRefDocumentId: "ทดสอบ 002/2569",
  startDate: new Date("2026-09-05T00:00:00Z"),
  endDate: new Date("2026-09-17T00:00:00Z"),
  location: "พื้นที่ทดสอบสอง",
};
const claim = {
  id: "claim-fixture-1",
  expenseMonth: new Date("2026-09-01T00:00:00Z"),
  claimantPositionAtSubmission: "ตำแหน่งขณะยื่นคำขอ",
  selectedDates: [
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-10",
    "2026-09-17",
  ],
  countDates: 5,
  amount: 750,
  status: "PENDING_LEADER_VERIFY" as const,
  claimant,
};
const secondClaim = {
  ...claim,
  id: "claim-fixture-2",
  claimant: {
    ...claimant,
    id: "claimant-fixture-2",
    firstName: "ผู้ยื่นทดสอบ",
    lastName: "คนที่สอง",
    employeeId: "EMP-FIXTURE-2",
  },
  selectedDates: ["2026-09-03"],
  countDates: 1,
  amount: 150,
};
const verification = {
  expiresAt: new Date("2099-12-31T23:59:59Z"),
  verifiedAt: null,
  createdAt: new Date("2026-09-18T00:00:00Z"),
};

/** Synthetic rows deliberately include two overlapping orders for one claim. */
export const leaderQueueItems: LeaderVerificationQueueItem[] = [
  {
    ...verification,
    id: "verification-fixture-1",
    expenseClaimId: claim.id,
    offSiteWorkId: firstWork.id,
    offSiteWork: firstWork,
    expenseClaim: claim,
  },
  {
    ...verification,
    id: "verification-fixture-2",
    expenseClaimId: claim.id,
    offSiteWorkId: secondWork.id,
    offSiteWork: secondWork,
    expenseClaim: claim,
  },
  {
    ...verification,
    id: "verification-fixture-3",
    expenseClaimId: secondClaim.id,
    offSiteWorkId: firstWork.id,
    offSiteWork: firstWork,
    expenseClaim: secondClaim,
  },
];

export const leaderQueueClaimDetail: LeaderClaimDetail = {
  ...claim,
  remark: "หมายเหตุสำหรับเอกสารทดสอบฉบับแรก",
  expenseClaimOffSiteWorks: [firstWork, secondWork].map((offSiteWork) => ({
    offSiteWorkId: offSiteWork.id,
    offSiteWork,
  })),
};

export const secondLeaderQueueClaimDetail: LeaderClaimDetail = {
  ...secondClaim,
  remark: "หมายเหตุสำหรับเอกสารทดสอบฉบับที่สอง",
  expenseClaimOffSiteWorks: [{ offSiteWorkId: firstWork.id, offSiteWork: firstWork }],
};
