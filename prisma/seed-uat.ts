/**
 * Deterministic optional UAT fixtures for the clean-break allowance workflow.
 * Kept separate from prisma/seed.ts so the default seed remains permission-only.
 * Run with: bun run db:seed:uat
 */
import { createHash } from "node:crypto";
import { prisma } from "../lib/db";
import { type Prisma } from "../lib/generated/prisma/client";
import {
  assignDefaultRolePermissions,
  seedPermissions,
} from "../lib/domains/permission/seed";
import type { LeaderVerificationPayload } from "../lib/domains/leader-verification/types";
import { createMonthlyRequestItemDates } from "../lib/domains/monthly-request-collection/item-date-persistence";

const UAT_SIGNATURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const DEPARTMENT_IDS = {
  operations: "00000000-0000-4000-8000-00000000a001",
  engineering: "00000000-0000-4000-8000-00000000a002",
} as const;

const USER_IDS = {
  leader: "00000000-0000-4000-8000-00000000b006",
  collector: "00000000-0000-4000-8000-00000000b007",
  admin: "00000000-0000-4000-8000-00000000b008",
} as const;

const CLAIMANT_USER_IDS = Array.from({ length: 20 }, (_, index) => {
  return `00000000-0000-4000-8000-00000000b${String(index + 100).padStart(3, "0")}`;
});

interface DepartmentFixture {
  id: string;
  name: string;
  shortName: string;
  description: string;
}

interface UserFixture {
  id: string;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position: string;
  positionShort: string;
  positionLevel: string;
  departmentId: string;
  roleCode: "employee" | "collector" | "super-admin";
}

interface OffSiteWorkFixture {
  id: string;
  innerRefDocumentId: string;
  startDate: string;
  endDate: string;
  objective: string;
  location: string;
  participantIds: string[];
}

interface WorkDateFixture {
  id: string;
  date: string;
  offSiteWorkId: string;
  dayType: "DUTY" | "TRAVEL";
  holidayType: "WORKDAY" | "WEEKEND" | "PUBLIC_HOLIDAY";
  holidayName: string | null;
  holidaySource: "GOOGLE" | "CALCULATED";
  requiresWeSafe: boolean;
  codes: Array<{ id: string; code: string }>;
}

interface ClaimFixture {
  id: string;
  revisionId: string;
  sequence: number;
  expenseMonth: string;
  claimantId: string;
  targetStatus:
    | "DRAFT"
    | "PENDING_LEADER_CONFIRMATION"
    | "READY_FOR_COLLECTION"
    | "REJECTED"
    | "COLLECTED";
  verificationState: "NONE" | "PENDING" | "CONFIRMED" | "SUPERSEDED";
  remark: string;
  rejectionReason: string | null;
  workDates: WorkDateFixture[];
}

interface MonthFixtureConfig {
  key: string;
  expenseMonth: string;
  mainOffSiteWorkId: string;
  secondaryOffSiteWorkId: string;
  mainReference: string;
  secondaryReference: string;
  collectedIndex: number;
  pendingIndex: number;
  rejectedIndex: number;
  draftIndex: number;
}

const DEPARTMENTS: DepartmentFixture[] = [
  {
    id: DEPARTMENT_IDS.operations,
    name: "ฝ่ายปฏิบัติการ UAT",
    shortName: "UAT-OPS",
    description: "ข้อมูลทดสอบ workflow ฝ่ายปฏิบัติการ",
  },
  {
    id: DEPARTMENT_IDS.engineering,
    name: "ฝ่ายวิศวกรรม UAT",
    shortName: "UAT-ENG",
    description: "ข้อมูลทดสอบ workflow ฝ่ายวิศวกรรม",
  },
];

const CLAIMANT_NAMES = [
  ["กิตติ", "แสงทอง"],
  ["สุเมธ", "ใจดี"],
  ["อนันต์", "พูนผล"],
  ["วิชัย", "มั่นคง"],
  ["นรินทร์", "ศรีสุข"],
  ["ธนา", "เจริญกิจ"],
  ["ปกรณ์", "บุญส่ง"],
  ["ศุภชัย", "วัฒนะ"],
  ["ธีรภัทร", "คงดี"],
  ["ณัฐพล", "มีชัย"],
  ["อดิศร", "สว่างวงศ์"],
  ["เอกชัย", "รุ่งเรือง"],
  ["พิมพ์ชนก", "แก้วกาญจน์"],
  ["สุภาวดี", "ทองแท้"],
  ["ชลธิชา", "เพิ่มพูน"],
  ["กัญญาณัฐ", "ชื่นใจ"],
  ["ธนพร", "วิริยะ"],
  ["อรทัย", "พรหมมา"],
  ["เบญจมาศ", "สมบูรณ์"],
  ["ศิริพร", "อุดมทรัพย์"],
] as const;

const CLAIMANT_USERS: UserFixture[] = CLAIMANT_NAMES.map(
  ([firstName, lastName], index) => {
    const operations = index < 12;
    return {
      id: CLAIMANT_USER_IDS[index],
      keycloakId: `uat-claimant-${String(index + 1).padStart(2, "0")}`,
      email: `uat.claimant.${String(index + 1).padStart(2, "0")}@example.test`,
      firstName,
      lastName,
      employeeId: String(310001 + index),
      position: operations ? "พนักงานปฏิบัติการ" : "วิศวกร",
      positionShort: operations ? "พป." : "วก.",
      positionLevel: String(4 + (index % 4)),
      departmentId: operations
        ? DEPARTMENT_IDS.operations
        : DEPARTMENT_IDS.engineering,
      roleCode: "employee",
    };
  },
);

const USERS: UserFixture[] = [
  ...CLAIMANT_USERS,
  {
    id: USER_IDS.leader,
    keycloakId: "uat-leader",
    email: "uat.leader@example.test",
    firstName: "หัวหน้าชุด",
    lastName: "ทดสอบ",
    employeeId: "900001",
    position: "หัวหน้าแผนกปฏิบัติการ",
    positionShort: "หผ.",
    positionLevel: "9",
    departmentId: DEPARTMENT_IDS.operations,
    roleCode: "employee",
  },
  {
    id: USER_IDS.collector,
    keycloakId: "uat-collector",
    email: "uat.collector@example.test",
    firstName: "ผู้รวบรวม",
    lastName: "ทดสอบ",
    employeeId: "900002",
    position: "พนักงานตรวจสอบ",
    positionShort: "พต.",
    positionLevel: "7",
    departmentId: DEPARTMENT_IDS.operations,
    roleCode: "collector",
  },
  {
    id: USER_IDS.admin,
    keycloakId: "uat-admin",
    email: "uat.admin@example.test",
    firstName: "ผู้ดูแลระบบ",
    lastName: "ทดสอบ",
    employeeId: "900003",
    position: "ผู้ดูแลระบบ",
    positionShort: "ผดร.",
    positionLevel: "9",
    departmentId: DEPARTMENT_IDS.engineering,
    roleCode: "super-admin",
  },
];

const MONTH_CONFIGS: MonthFixtureConfig[] = [
  {
    key: "2026-06",
    expenseMonth: "2026-06-01",
    mainOffSiteWorkId: "UAT-LARGE-OSW-2026-06-MAIN",
    secondaryOffSiteWorkId: "UAT-LARGE-OSW-2026-06-OVERLAP",
    mainReference: "กฟ-UAT/2569-มิ.ย.-หลัก",
    secondaryReference: "กฟ-UAT/2569-มิ.ย.-เสริม",
    collectedIndex: 0,
    pendingIndex: 1,
    rejectedIndex: 2,
    draftIndex: 3,
  },
  {
    key: "2026-07",
    expenseMonth: "2026-07-01",
    mainOffSiteWorkId: "UAT-LARGE-OSW-2026-07-MAIN",
    secondaryOffSiteWorkId: "UAT-LARGE-OSW-2026-07-OVERLAP",
    mainReference: "กฟ-UAT/2569-ก.ค.-หลัก",
    secondaryReference: "กฟ-UAT/2569-ก.ค.-เสริม",
    collectedIndex: 12,
    pendingIndex: 4,
    rejectedIndex: 5,
    draftIndex: 6,
  },
  {
    key: "2026-08",
    expenseMonth: "2026-08-01",
    mainOffSiteWorkId: "UAT-LARGE-OSW-2026-08-MAIN",
    secondaryOffSiteWorkId: "UAT-LARGE-OSW-2026-08-OVERLAP",
    mainReference: "กฟ-UAT/2569-ส.ค.-หลัก",
    secondaryReference: "กฟ-UAT/2569-ส.ค.-เสริม",
    collectedIndex: 7,
    pendingIndex: 8,
    rejectedIndex: 13,
    draftIndex: 9,
  },
];

const OFF_SITE_WORKS: OffSiteWorkFixture[] = MONTH_CONFIGS.flatMap((month) => [
  {
    id: month.mainOffSiteWorkId,
    innerRefDocumentId: month.mainReference,
    startDate: `${month.key}-01`,
    endDate: `${month.key}-28`,
    objective: "ปฏิบัติงานตรวจสอบและบำรุงรักษาระบบภาคสนามร่วมกันเป็นคณะ",
    location: `พื้นที่ปฏิบัติงาน UAT ประจำเดือน ${month.key}`,
    participantIds: CLAIMANT_USER_IDS,
  },
  {
    id: month.secondaryOffSiteWorkId,
    innerRefDocumentId: month.secondaryReference,
    startDate: `${month.key}-17`,
    endDate: `${month.key}-28`,
    objective: "งานเสริมที่มีช่วงเวลาคาบเกี่ยว เพื่อทดสอบการเลือกใบนำตัวหลักรายวัน",
    location: `พื้นที่ปฏิบัติงานเสริม UAT ประจำเดือน ${month.key}`,
    participantIds: CLAIMANT_USER_IDS.slice(17, 20),
  },
]);

const PUBLIC_HOLIDAYS: Record<string, string> = {
  "2026-06-03": "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี",
  "2026-07-28": "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว",
  "2026-08-12": "วันแม่แห่งชาติ",
};

function workDate(
  claimKey: string,
  date: string,
  offSiteWorkId: string,
  options: Omit<WorkDateFixture, "id" | "date" | "offSiteWorkId" | "codes"> & {
    codes?: string[];
  },
): WorkDateFixture {
  return {
    id: `${claimKey}-DATE-${date}`,
    date,
    offSiteWorkId,
    dayType: options.dayType,
    holidayType: options.holidayType,
    holidayName: options.holidayName,
    holidaySource: options.holidaySource,
    requiresWeSafe: options.requiresWeSafe,
    codes: (options.codes ?? []).map((code, index) => ({
      id: `${claimKey}-DATE-${date}-CODE-${index + 1}`,
      code,
    })),
  };
}

function dayRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function claimDays(claimantIndex: number): number[] {
  if (claimantIndex === 10) return dayRange(1, 28);
  if (claimantIndex === 11) return dayRange(1, 15);
  if (claimantIndex === 18) return [...dayRange(1, 14), ...dayRange(21, 28)];
  return dayRange(1, 22);
}

function targetStatus(
  month: MonthFixtureConfig,
  claimantIndex: number,
): ClaimFixture["targetStatus"] {
  if (claimantIndex === month.collectedIndex) return "COLLECTED";
  if (claimantIndex === month.pendingIndex) return "PENDING_LEADER_CONFIRMATION";
  if (claimantIndex === month.rejectedIndex) return "REJECTED";
  if (claimantIndex === month.draftIndex) return "DRAFT";
  return "READY_FOR_COLLECTION";
}

function verificationState(
  status: ClaimFixture["targetStatus"],
): ClaimFixture["verificationState"] {
  if (status === "DRAFT") return "NONE";
  if (status === "PENDING_LEADER_CONFIRMATION") return "PENDING";
  if (status === "REJECTED") return "SUPERSEDED";
  return "CONFIRMED";
}

function remarkFor(claimantIndex: number): string {
  if (claimantIndex === 10) return "ปฏิบัติงานต่อเนื่องตามแผนเร่งรัด";
  if (claimantIndex === 11) return "ปฏิบัติงานบางช่วงตามที่ได้รับมอบหมาย";
  if (claimantIndex === 18) return "สับเปลี่ยนรอบปฏิบัติงานกับทีม";
  if (claimantIndex === 19) return "ปฏิบัติงานคาบเกี่ยวใบนำตัวสองใบ";
  if (claimantIndex === 17) return "บันทึก WeSafe จากเอกสารประกอบการเดินทาง";
  return "ปฏิบัติงานร่วมกับคณะตามใบนำตัว";
}

function workDateMetadata(date: string, offSiteWorkId: string) {
  const offSiteWork = getOffSiteWork(offSiteWorkId);
  const dayOfWeek = asDate(date).getUTCDay();
  const publicHolidayName = PUBLIC_HOLIDAYS[date];
  const dayType =
    date === offSiteWork.startDate || date === offSiteWork.endDate
      ? ("TRAVEL" as const)
      : ("DUTY" as const);
  const holidayType = publicHolidayName
    ? ("PUBLIC_HOLIDAY" as const)
    : dayOfWeek === 0 || dayOfWeek === 6
      ? ("WEEKEND" as const)
      : ("WORKDAY" as const);
  const holidayName = publicHolidayName
    ? publicHolidayName
    : holidayType === "WEEKEND"
      ? dayOfWeek === 6
        ? "วันเสาร์"
        : "วันอาทิตย์"
      : null;
  return {
    dayType,
    holidayType,
    holidayName,
    holidaySource:
      holidayType === "WEEKEND" ? ("CALCULATED" as const) : ("GOOGLE" as const),
    requiresWeSafe: dayType === "TRAVEL" || holidayType !== "WORKDAY",
  };
}

function weSafeCode(sequence: number, day: number): string {
  return `WSZ2026HZ${String(sequence * 100 + day).padStart(10, "0")}`;
}

function buildClaimWorkDates(
  month: MonthFixtureConfig,
  claimantIndex: number,
  sequence: number,
  status: ClaimFixture["targetStatus"],
  claimId: string,
): WorkDateFixture[] {
  return claimDays(claimantIndex).map((day) => {
    const date = `${month.key}-${String(day).padStart(2, "0")}`;
    const offSiteWorkId =
      claimantIndex === 19 && day >= 17
        ? month.secondaryOffSiteWorkId
        : month.mainOffSiteWorkId;
    const metadata = workDateMetadata(date, offSiteWorkId);
    let codes = metadata.requiresWeSafe ? [weSafeCode(sequence, day)] : [];
    if (status === "DRAFT" && day === 1) codes = [];
    if (claimantIndex === 17 && day === 1) {
      codes = [weSafeCode(sequence, day), weSafeCode(sequence, day)];
    }
    return workDate(claimId, date, offSiteWorkId, { ...metadata, codes });
  });
}

const CLAIMS: ClaimFixture[] = MONTH_CONFIGS.flatMap((month, monthIndex) =>
  CLAIMANT_USERS.map((claimant, claimantIndex) => {
    const sequence = monthIndex * CLAIMANT_USERS.length + claimantIndex + 1;
    const status = targetStatus(month, claimantIndex);
    const id = `UAT-LARGE-CLAIM-${month.key}-${String(claimantIndex + 1).padStart(2, "0")}`;
    return {
      id,
      revisionId: `${id}-R1`,
      sequence,
      expenseMonth: month.expenseMonth,
      claimantId: claimant.id,
      targetStatus: status,
      verificationState: verificationState(status),
      remark: remarkFor(claimantIndex),
      rejectionReason:
        status === "REJECTED"
          ? "วันที่เบิกบางส่วนไม่สอดคล้องกับข้อมูลของผู้ร่วมเดินทาง กรุณาตรวจสอบและส่งใหม่"
          : null,
      workDates: buildClaimWorkDates(
        month,
        claimantIndex,
        sequence,
        status,
        id,
      ),
    };
  }),
);

function validateFixtures(): void {
  const problems: string[] = [];
  if (CLAIMANT_USERS.length !== 20) {
    problems.push(`expected 20 claimants, got ${CLAIMANT_USERS.length}`);
  }
  if (MONTH_CONFIGS.length !== 3) {
    problems.push(`expected 3 months, got ${MONTH_CONFIGS.length}`);
  }
  if (CLAIMS.length !== CLAIMANT_USERS.length * MONTH_CONFIGS.length) {
    problems.push(`expected 60 claims, got ${CLAIMS.length}`);
  }

  const claimKeys = new Set<string>();
  for (const claim of CLAIMS) {
    const uniqueKey = `${claim.claimantId}:${claim.expenseMonth}`;
    if (claimKeys.has(uniqueKey)) problems.push(`duplicate claim ${uniqueKey}`);
    claimKeys.add(uniqueKey);

    if (claim.workDates.length < 15 || claim.workDates.length > 28) {
      problems.push(`${claim.id} has ${claim.workDates.length} dates`);
    }
    const dates = new Set<string>();
    for (const item of claim.workDates) {
      if (dates.has(item.date)) problems.push(`${claim.id} repeats ${item.date}`);
      dates.add(item.date);
      if (!item.date.startsWith(claim.expenseMonth.slice(0, 7))) {
        problems.push(`${claim.id} has date outside its month: ${item.date}`);
      }

      const offSiteWork = getOffSiteWork(item.offSiteWorkId);
      if (!offSiteWork.participantIds.includes(claim.claimantId)) {
        problems.push(`${claim.id} claimant is not in ${offSiteWork.id}`);
      }
      if (item.date < offSiteWork.startDate || item.date > offSiteWork.endDate) {
        problems.push(`${claim.id} has ${item.date} outside ${offSiteWork.id}`);
      }
      for (const code of item.codes) {
        if (code.code !== code.code.trim() || code.code.length !== 19) {
          problems.push(`${claim.id} has invalid WeSafe code on ${item.date}`);
        }
      }
      if (
        claim.targetStatus !== "DRAFT" &&
        item.requiresWeSafe &&
        item.codes.length === 0
      ) {
        problems.push(`${claim.id} is missing WeSafe on ${item.date}`);
      }
    }
  }

  for (const month of MONTH_CONFIGS) {
    const patternCounts = new Map<string, number>();
    for (const claim of CLAIMS.filter(
      (item) => item.expenseMonth === month.expenseMonth,
    )) {
      const mainDates = claim.workDates
        .filter((item) => item.offSiteWorkId === month.mainOffSiteWorkId)
        .map((item) => item.date)
        .sort()
        .join("|");
      patternCounts.set(mainDates, (patternCounts.get(mainDates) ?? 0) + 1);
    }
    const majorityCount = Math.max(0, ...patternCounts.values());
    if (majorityCount < 15) {
      problems.push(
        `${month.key} main pattern has only ${majorityCount} matching claims`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid UAT fixtures:\n- ${problems.join("\n- ")}`);
  }
}

type TransactionClient = Prisma.TransactionClient;

function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function monthTimestamp(expenseMonth: string, day: number): Date {
  const month = asDate(expenseMonth);
  return new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 2, 0, 0),
  );
}

function claimTimeline(claim: ClaimFixture) {
  const month = asDate(claim.expenseMonth);
  return {
    createdAt: monthTimestamp(claim.expenseMonth, 1),
    submittedAt: monthTimestamp(claim.expenseMonth, 2),
    confirmedAt: monthTimestamp(claim.expenseMonth, 3),
    rejectedAt: monthTimestamp(claim.expenseMonth, 4),
    collectedAt: monthTimestamp(claim.expenseMonth, 5),
    tokenExpiresAt: new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 15, 2, 0, 0),
    ),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashJson(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function getUser(id: string): UserFixture {
  const user = USERS.find((item) => item.id === id);
  if (!user) throw new Error(`Missing UAT user fixture: ${id}`);
  return user;
}

function getDepartment(id: string): DepartmentFixture {
  const department = DEPARTMENTS.find((item) => item.id === id);
  if (!department) throw new Error(`Missing UAT department fixture: ${id}`);
  return department;
}

function getOffSiteWork(id: string): OffSiteWorkFixture {
  const offSiteWork = OFF_SITE_WORKS.find((item) => item.id === id);
  if (!offSiteWork) throw new Error(`Missing UAT off-site work fixture: ${id}`);
  return offSiteWork;
}

function revisionOffSiteWorkId(revisionId: string, offSiteWorkId: string): string {
  return `${revisionId}:${offSiteWorkId}`;
}

function verificationId(revisionId: string, offSiteWorkId: string): string {
  return `UAT-VERIFY:${revisionId}:${offSiteWorkId}`;
}

function rawVerificationToken(revisionId: string, offSiteWorkId: string): string {
  return createHash("sha256")
    .update(`UAT-RAW-TOKEN:${revisionId}:${offSiteWorkId}`, "utf8")
    .digest("base64url");
}

function involvedOffSiteWorkIds(claim: ClaimFixture): string[] {
  return [...new Set(claim.workDates.map((item) => item.offSiteWorkId))];
}

/** Mirrors expense-claim-document/service.ts materialHash exactly. */
function claimMaterialHash(claim: ClaimFixture): string {
  const claimant = getUser(claim.claimantId);
  const department = getDepartment(claimant.departmentId);
  const leader = getUser(USER_IDS.leader);
  const canonical = {
    claimant: {
      employeeId: claimant.employeeId.padStart(6, "0"),
      firstName: claimant.firstName,
      lastName: claimant.lastName,
      position: claimant.position,
      positionShort: claimant.positionShort,
      positionLevel: claimant.positionLevel,
      departmentId: department.id,
      departmentName: department.name,
      departmentShort: department.shortName,
    },
    remark: claim.remark.trim() || null,
    offSiteWorks: involvedOffSiteWorkIds(claim)
      .map((id) => {
        const offSiteWork = getOffSiteWork(id);
        return {
          id: offSiteWork.id,
          innerRefDocumentId: offSiteWork.innerRefDocumentId,
          startDate: offSiteWork.startDate,
          endDate: offSiteWork.endDate,
          objective: offSiteWork.objective,
          location: offSiteWork.location,
          leaderUserId: leader.id,
          leaderEmpId: leader.employeeId,
          leaderFirstName: leader.firstName,
          leaderLastName: leader.lastName,
          leaderPosition: leader.position,
          leaderEmail: leader.email,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
    workDates: claim.workDates
      .map((item) => ({
        date: item.date,
        offSiteWorkId: item.offSiteWorkId,
        dayType: item.dayType,
        holidayType: item.holidayType,
        holidayName: item.holidayName,
        holidaySource: item.holidaySource,
        requiresWeSafe: item.requiresWeSafe,
        weSafeCodes: item.codes.map((code) => code.code).sort(),
      }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    ratePerDay: 150,
  };
  return hashJson(canonical);
}

function buildVerificationPayload(
  claim: ClaimFixture,
  offSiteWorkId: string,
): LeaderVerificationPayload {
  const claimant = getUser(claim.claimantId);
  const department = getDepartment(claimant.departmentId);
  const offSiteWork = getOffSiteWork(offSiteWorkId);
  const dates = claim.workDates.filter(
    (item) => item.offSiteWorkId === offSiteWorkId,
  );

  return {
    version: 1,
    claim: {
      id: claim.id,
      revisionNo: 1,
      expenseMonth: claim.expenseMonth,
      claimant: {
        employeeId: claimant.employeeId.padStart(6, "0"),
        firstName: claimant.firstName,
        lastName: claimant.lastName,
        position: claimant.position,
        positionShort: claimant.positionShort,
        positionLevel: claimant.positionLevel,
        departmentName: department.name,
        departmentShort: department.shortName,
      },
    },
    offSiteWork: {
      id: offSiteWork.id,
      innerRefDocumentId: offSiteWork.innerRefDocumentId,
      startDate: offSiteWork.startDate,
      endDate: offSiteWork.endDate,
      objective: offSiteWork.objective,
      location: offSiteWork.location,
    },
    rate: 150,
    dates: dates.map((item) => ({
      date: item.date,
      dayType: item.dayType,
      holidayType: item.holidayType,
      holidayName: item.holidayName,
      weSafeCodes: item.codes.map((code) => code.code),
      dailyRate: 150,
    })),
    countDates: dates.length,
    amount: dates.length * 150,
  };
}

async function cleanupOwnedWorkflowFixtures(tx: TransactionClient): Promise<void> {
  const scopedClaims = await tx.expenseClaim.findMany({
    where: {
      userId: { in: CLAIMANT_USER_IDS },
      expenseMonth: { in: MONTH_CONFIGS.map((month) => asDate(month.expenseMonth)) },
    },
    select: {
      id: true,
      revisions: {
        select: {
          id: true,
          offSiteWorks: { select: { id: true } },
          workDates: {
            select: {
              id: true,
              weSafeCodes: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  const claimIds = scopedClaims.map((claim) => claim.id);
  const revisionIds = scopedClaims.flatMap((claim) =>
    claim.revisions.map((revision) => revision.id),
  );
  const workDateIds = scopedClaims.flatMap((claim) =>
    claim.revisions.flatMap((revision) =>
      revision.workDates.map((workDate) => workDate.id),
    ),
  );
  const codeIds = scopedClaims.flatMap((claim) =>
    claim.revisions.flatMap((revision) =>
      revision.workDates.flatMap((workDate) =>
        workDate.weSafeCodes.map((code) => code.id),
      ),
    ),
  );
  const revisionOffSiteWorkIds = scopedClaims.flatMap((claim) =>
    claim.revisions.flatMap((revision) =>
      revision.offSiteWorks.map((offSiteWork) => offSiteWork.id),
    ),
  );

  if (
    claimIds.length > 0 &&
    (await tx.claimReviewFlag.count({
      where: { expenseClaimId: { in: claimIds } },
    })) > 0
  ) {
    throw new Error(
      "UAT claims contain append-only review history. Reset the test database before reseeding.",
    );
  }

  const scopedMrcs = await tx.monthlyRequestCollection.findMany({
    where: {
      OR: [
        { id: { startsWith: "UAT-LARGE-MRC-" } },
        { items: { some: { expenseClaimId: { in: claimIds } } } },
      ],
    },
    select: { id: true, status: true },
  });
  if (scopedMrcs.some((mrc) => mrc.status !== "DRAFT")) {
    throw new Error(
      "UAT monthly requests are no longer Draft. Reset the test database before reseeding.",
    );
  }
  const scopedMrcIds = scopedMrcs.map((item) => item.id);
  await tx.mrcReplacementSource.deleteMany({
    where: {
      OR: [
        { replacementDraftId: { in: scopedMrcIds } },
        { voidedMrcId: { in: scopedMrcIds } },
      ],
    },
  });
  await tx.monthlyRequestCollectionItem.deleteMany({
    where: {
      OR: [
        { monthlyRequestCollectionId: { in: scopedMrcIds } },
        { expenseClaimId: { in: claimIds } },
      ],
    },
  });
  await tx.monthlyRequestCollection.deleteMany({
    where: { id: { in: scopedMrcIds } },
  });
  await tx.leaderVerification.deleteMany({
    where: { claimRevisionId: { in: revisionIds } },
  });

  // Snapshot children are mutable/deletable only while their revision is DRAFT.
  await tx.expenseClaimRevision.updateMany({
    where: { id: { in: revisionIds } },
    data: { status: "DRAFT", submittedAt: null, supersededAt: null },
  });
  await tx.expenseClaimWorkDateWeSafeCode.deleteMany({
    where: { id: { in: codeIds } },
  });
  await tx.expenseClaimWorkDate.deleteMany({
    where: { id: { in: workDateIds } },
  });
  await tx.expenseClaimRevisionOffSiteWork.deleteMany({
    where: { id: { in: revisionOffSiteWorkIds } },
  });

  // The current-revision FK is DEFERRABLE, so both ends are removed atomically.
  await tx.expenseClaimRevision.deleteMany({
    where: { id: { in: revisionIds } },
  });
  await tx.expenseClaim.deleteMany({ where: { id: { in: claimIds } } });
  await tx.offSiteWork.deleteMany({
    where: { supersedesId: { in: OFF_SITE_WORKS.map((item) => item.id) } },
  });
  await tx.offSiteWork.deleteMany({
    where: { id: { in: OFF_SITE_WORKS.map((item) => item.id) } },
  });
}

async function upsertDepartmentsAndUsers(tx: TransactionClient): Promise<void> {
  for (const department of DEPARTMENTS) {
    await tx.department.upsert({
      where: { id: department.id },
      update: {
        name: department.name,
        shortName: department.shortName,
        description: department.description,
        isActive: true,
      },
      create: { ...department, isActive: true },
    });
  }

  for (const user of USERS) {
    const data = {
      keycloakId: user.keycloakId,
      email: user.email,
      peaEmail: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      position: user.position,
      positionShort: user.positionShort,
      positionLevel: user.positionLevel,
      departmentId: user.departmentId,
      status: "ACTIVE" as const,
    };
    await tx.user.upsert({
      where: { id: user.id },
      update: data,
      create: { id: user.id, ...data },
    });
  }
}

async function upsertUserRoles(
  tx: TransactionClient,
  roleIdsByCode: Map<string, string>,
): Promise<void> {
  for (const [index, user] of USERS.entries()) {
    const roleId = roleIdsByCode.get(user.roleCode);
    if (!roleId) throw new Error(`Missing role: ${user.roleCode}`);
    const id = `UAT-LARGE-USER-ROLE-${String(index + 1).padStart(2, "0")}`;
    await tx.userRole.upsert({
      where: { id },
      update: {
        userId: user.id,
        roleId,
        departmentId: null,
        assignedById: USER_IDS.admin,
        expiresAt: null,
        isActive: true,
      },
      create: {
        id,
        userId: user.id,
        roleId,
        departmentId: null,
        assignedById: USER_IDS.admin,
        isActive: true,
      },
    });
  }
}

async function createOffSiteWorks(tx: TransactionClient): Promise<void> {
  const leader = getUser(USER_IDS.leader);

  for (const offSiteWork of OFF_SITE_WORKS) {
    const expenseMonth = `${offSiteWork.startDate.slice(0, 7)}-01`;
    const createdAt = monthTimestamp(expenseMonth, 1);
    const lockedAt = monthTimestamp(expenseMonth, 2);
    await tx.offSiteWork.create({
      data: {
        id: offSiteWork.id,
        innerRefDocumentId: offSiteWork.innerRefDocumentId,
        startDate: asDate(offSiteWork.startDate),
        endDate: asDate(offSiteWork.endDate),
        objective: offSiteWork.objective,
        location: offSiteWork.location,
        postedAt: createdAt,
        postedByUserId: USER_IDS.collector,
        lockedAt,
        leaderUserId: leader.id,
        leaderEmpId: leader.employeeId,
        leaderFirstName: leader.firstName,
        leaderLastName: leader.lastName,
        leaderPosition: leader.position,
        leaderEmail: leader.email,
      },
    });

    await tx.offSiteWorkParticipant.createMany({
      data: CLAIMANT_USERS.filter((user) =>
        offSiteWork.participantIds.includes(user.id),
      ).map((user) => {
        const department = getDepartment(user.departmentId);
        return {
          offSiteWorkId: offSiteWork.id,
          userId: user.id,
          employeeIdSnapshot: user.employeeId.padStart(6, "0"),
          firstNameSnapshot: user.firstName,
          lastNameSnapshot: user.lastName,
          positionSnapshot: user.position,
          positionShortSnapshot: user.positionShort,
          positionLevelSnapshot: user.positionLevel,
          departmentIdSnapshot: department.id,
          departmentNameSnapshot: department.name,
          createdAt,
        };
      }),
    });
  }
}

async function createClaim(
  tx: TransactionClient,
  claim: ClaimFixture,
): Promise<void> {
  const claimant = getUser(claim.claimantId);
  const department = getDepartment(claimant.departmentId);
  const totalDays = claim.workDates.length;
  const materialHash = claimMaterialHash(claim);
  const timeline = claimTimeline(claim);

  await tx.expenseClaim.create({
    data: {
      id: claim.id,
      expenseMonth: asDate(claim.expenseMonth),
      userId: claimant.id,
      createdById: claimant.id,
      status: "DRAFT",
      currentRevisionNo: 1,
      createdAt: timeline.createdAt,
      updatedAt: timeline.createdAt,
    },
  });
  await tx.expenseClaimRevision.create({
    data: {
      id: claim.revisionId,
      expenseClaimId: claim.id,
      revisionNo: 1,
      status: "DRAFT",
      employeeIdSnapshot: claimant.employeeId.padStart(6, "0"),
      firstNameSnapshot: claimant.firstName,
      lastNameSnapshot: claimant.lastName,
      positionSnapshot: claimant.position,
      positionShortSnapshot: claimant.positionShort,
      positionLevelSnapshot: claimant.positionLevel,
      departmentIdSnapshot: department.id,
      departmentNameSnapshot: department.name,
      departmentShortSnapshot: department.shortName,
      ratePerDay: 150,
      totalDays,
      totalAmount: totalDays * 150,
      remark: claim.remark,
      materialHash,
      createdAt: timeline.createdAt,
      updatedAt: timeline.createdAt,
    },
  });

  const leader = getUser(USER_IDS.leader);
  await tx.expenseClaimRevisionOffSiteWork.createMany({
    data: involvedOffSiteWorkIds(claim).map((offSiteWorkId) => {
      const offSiteWork = getOffSiteWork(offSiteWorkId);
      return {
        id: revisionOffSiteWorkId(claim.revisionId, offSiteWorkId),
        revisionId: claim.revisionId,
        offSiteWorkId,
        innerRefDocumentIdSnapshot: offSiteWork.innerRefDocumentId,
        startDateSnapshot: asDate(offSiteWork.startDate),
        endDateSnapshot: asDate(offSiteWork.endDate),
        objectiveSnapshot: offSiteWork.objective,
        locationSnapshot: offSiteWork.location,
        leaderUserIdSnapshot: leader.id,
        leaderEmpIdSnapshot: leader.employeeId.padStart(6, "0"),
        leaderFirstNameSnapshot: leader.firstName,
        leaderLastNameSnapshot: leader.lastName,
        leaderPositionSnapshot: leader.position,
        leaderEmailSnapshot: leader.email,
        createdAt: timeline.createdAt,
      };
    }),
  });

  await tx.expenseClaimWorkDate.createMany({
    data: claim.workDates.map((item) => ({
      id: item.id,
      revisionId: claim.revisionId,
      revisionOffSiteWorkId: revisionOffSiteWorkId(
        claim.revisionId,
        item.offSiteWorkId,
      ),
      workDate: asDate(item.date),
      dayType: item.dayType,
      holidayType: item.holidayType,
      holidayName: item.holidayName,
      holidaySource: item.holidaySource,
      requiresWeSafe: item.requiresWeSafe,
      dailyRate: 150,
      createdAt: timeline.createdAt,
    })),
  });
  const weSafeCodes = claim.workDates.flatMap((item) =>
    item.codes.map((code) => ({
      id: code.id,
      workDateId: item.id,
      code: code.code,
      createdAt: timeline.createdAt,
    })),
  );
  if (weSafeCodes.length > 0) {
    await tx.expenseClaimWorkDateWeSafeCode.createMany({ data: weSafeCodes });
  }

  if (claim.verificationState !== "NONE") {
    await tx.leaderVerification.createMany({
      data: involvedOffSiteWorkIds(claim).map((offSiteWorkId) => {
        const payload = buildVerificationPayload(claim, offSiteWorkId);
        const rawToken = rawVerificationToken(claim.revisionId, offSiteWorkId);
        return {
          id: verificationId(claim.revisionId, offSiteWorkId),
          claimRevisionId: claim.revisionId,
          revisionOffSiteWorkId: revisionOffSiteWorkId(
            claim.revisionId,
            offSiteWorkId,
          ),
          status: "PENDING",
          leaderUserId: leader.id,
          leaderEmpIdSnapshot: leader.employeeId.padStart(6, "0"),
          leaderFirstNameSnapshot: leader.firstName,
          leaderLastNameSnapshot: leader.lastName,
          leaderPositionSnapshot: leader.position,
          leaderEmailSnapshot: leader.email,
          tokenHash: sha256(rawToken),
          expiresAt: timeline.tokenExpiresAt,
          payloadSnapshot: payload as unknown as Prisma.InputJsonValue,
          payloadHash: hashJson(payload),
          createdAt: timeline.submittedAt,
        };
      }),
    });
  }

  if (claim.targetStatus === "DRAFT") return;

  await tx.expenseClaimRevision.update({
    where: { id: claim.revisionId },
    data: { status: "SUBMITTED", submittedAt: timeline.submittedAt },
  });

  if (
    claim.verificationState === "CONFIRMED" ||
    claim.verificationState === "SUPERSEDED"
  ) {
    await tx.leaderVerification.updateMany({
      where: { claimRevisionId: claim.revisionId },
      data: {
        status: "CONFIRMED",
        confirmedAt: timeline.confirmedAt,
        signatureData: UAT_SIGNATURE_PNG,
      },
    });
  }

  if (claim.targetStatus === "REJECTED") {
    await tx.leaderVerification.updateMany({
      where: { claimRevisionId: claim.revisionId },
      data: { status: "SUPERSEDED", supersededAt: timeline.rejectedAt },
    });
    await tx.expenseClaimRevision.update({
      where: { id: claim.revisionId },
      data: { status: "SUPERSEDED", supersededAt: timeline.rejectedAt },
    });
    await tx.expenseClaim.update({
      where: { id: claim.id },
      data: {
        status: "REJECTED",
        rejectedAt: timeline.rejectedAt,
        rejectedById: USER_IDS.collector,
        rejectionReason: claim.rejectionReason,
      },
    });
    return;
  }

  if (claim.targetStatus === "COLLECTED") {
    await tx.expenseClaim.update({
      where: { id: claim.id },
      data: { status: "COLLECTED", collectedAt: timeline.collectedAt },
    });
    return;
  }

  await tx.expenseClaim.update({
    where: { id: claim.id },
    data: { status: claim.targetStatus },
  });
}

async function createDraftMonthlyRequests(tx: TransactionClient): Promise<void> {
  const grouped = new Map<string, ClaimFixture[]>();
  for (const claim of CLAIMS.filter((item) => item.targetStatus === "COLLECTED")) {
    const claimant = getUser(claim.claimantId);
    const key = `${claim.expenseMonth}:${claimant.departmentId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), claim]);
  }

  for (const claims of grouped.values()) {
    const first = claims[0];
    const firstClaimant = getUser(first.claimantId);
    const department = getDepartment(firstClaimant.departmentId);
    const monthKey = first.expenseMonth.slice(0, 7);
    const mrcId = `UAT-LARGE-MRC-${monthKey}-${department.shortName}`;
    const createdAt = claimTimeline(first).collectedAt;
    await tx.monthlyRequestCollection.create({
      data: {
        id: mrcId,
        departmentId: department.id,
        collectorId: USER_IDS.collector,
        collectForMonth: asDate(first.expenseMonth),
        batchNo: null,
        status: "DRAFT",
        claimCount: claims.length,
        countDates: claims.reduce((sum, claim) => sum + claim.workDates.length, 0),
        amount: claims.reduce(
          (sum, claim) => sum + claim.workDates.length * 150,
          0,
        ),
        snapshotVersion: 1,
        createdAt,
        updatedAt: createdAt,
      },
    });

    for (const [index, claim] of claims.entries()) {
      const claimant = getUser(claim.claimantId);
      const itemId = `${mrcId}-ITEM-${String(index + 1).padStart(2, "0")}`;
      await tx.monthlyRequestCollectionItem.create({
        data: {
          id: itemId,
          monthlyRequestCollectionId: mrcId,
          expenseClaimId: claim.id,
          claimRevisionId: claim.revisionId,
          addedById: USER_IDS.collector,
          addedAt: createdAt,
          rowNo: index + 1,
          employeeIdSnapshot: claimant.employeeId.padStart(6, "0"),
          firstNameSnapshot: claimant.firstName,
          lastNameSnapshot: claimant.lastName,
          positionShortSnapshot: claimant.positionShort,
          positionLevelSnapshot: claimant.positionLevel,
          departmentIdSnapshot: department.id,
          departmentNameSnapshot: department.name,
          departmentShortSnapshot: department.shortName,
          dayCountSnapshot: claim.workDates.length,
          amountSnapshot: claim.workDates.length * 150,
          remarkSnapshot: claim.remark,
          createdAt,
        },
      });
      await createMonthlyRequestItemDates(
        tx,
        itemId,
        claim.workDates.map((item) => {
          const offSiteWork = getOffSiteWork(item.offSiteWorkId);
          return {
            workDate: asDate(item.date),
            offSiteWorkIdSnapshot: item.offSiteWorkId,
            offSiteWorkRefSnapshot: offSiteWork.innerRefDocumentId,
            dayType: item.dayType,
            holidayType: item.holidayType,
            holidayName: item.holidayName,
            dailyRate: 150,
            weSafeCodes: item.codes.map((code) => code.code),
          };
        }),
      );
    }
  }
}

async function main(): Promise<void> {
  validateFixtures();
  console.log("Seeding permissions required by UAT roles...");
  await seedPermissions();
  await assignDefaultRolePermissions();

  const roles = await prisma.role.findMany({
    where: { code: { in: ["employee", "collector", "super-admin"] } },
    select: { id: true, code: true },
  });
  const roleIdsByCode = new Map(roles.map((role) => [role.code, role.id]));
  if (roleIdsByCode.size !== 3) {
    throw new Error("Default employee, collector, and super-admin roles are required");
  }

  await prisma.$transaction(
    async (tx) => {
      await cleanupOwnedWorkflowFixtures(tx);
      await upsertDepartmentsAndUsers(tx);
      await upsertUserRoles(tx, roleIdsByCode);
      await createOffSiteWorks(tx);
      for (const claim of CLAIMS) await createClaim(tx, claim);
      await createDraftMonthlyRequests(tx);
    },
    { timeout: 120_000 },
  );

  console.log("UAT fixtures ready for expense months 2026-06 through 2026-08:");
  console.log("  2 departments, 20 claimants, 3 support users");
  console.log("  6 off-site works (3 main groups + 3 overlapping groups)");
  console.log("  60 claims with 15-28 dates each and mixed workflow states");
  console.log("  Majority date patterns plus long, short, shifted, multi-OSW and duplicate-WeSafe examples");
}

main()
  .catch((error: unknown) => {
    console.error("UAT seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
