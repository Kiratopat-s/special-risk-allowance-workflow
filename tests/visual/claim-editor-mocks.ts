import type {
  EligibleOffSiteWorkOption,
  ExpenseClaimDocumentWithRelations,
} from "@/lib/domains/expense-claim-document/types";
import type { ClaimDocumentStatus, Pagination } from "@/lib/shared/types";

// All browser actions and permission hooks resolve here; this preview cannot
// load authentication, access a database, or send leader notifications.
const claimantId = "claim-editor-owner";
const claimant = {
  id: claimantId,
  firstName: "ผู้เบิก",
  lastName: "ตัวอย่าง",
  employeeId: "TEST-001",
  departmentId: "fixture-department",
};

export function claimEditorOrders(month = "2026-09"): EligibleOffSiteWorkOption[] {
  return [
    {
      id: "fixture-order-1",
      innerRefDocumentId: "คส. 101/2569",
      startDate: new Date(`${month}-01T00:00:00.000Z`),
      endDate: new Date(`${month}-15T00:00:00.000Z`),
      location: "พื้นที่ปฏิบัติงานตัวอย่าง เขต 1",
      objective: "ตรวจสอบและบำรุงรักษาระบบประจำเดือน",
      hasLeader: true,
      leaderFirstName: "หัวหน้า",
      leaderLastName: "ตัวอย่าง",
      leaderEmail: null,
    },
    {
      id: "fixture-order-2",
      innerRefDocumentId: "คส. 102/2569",
      startDate: new Date(`${month}-16T00:00:00.000Z`),
      endDate: new Date(`${month}-25T00:00:00.000Z`),
      location: "พื้นที่ปฏิบัติงานตัวอย่าง เขต 2",
      objective: "ตรวจสอบความปลอดภัยและติดตามผลการปฏิบัติงาน",
      hasLeader: true,
      leaderFirstName: "ผู้ควบคุม",
      leaderLastName: "ตัวอย่าง",
      leaderEmail: null,
    },
  ];
}

const selectedDates = [
  "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
  "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
  "2026-09-11", "2026-09-14",
];

function makeClaim(status: ClaimDocumentStatus): ExpenseClaimDocumentWithRelations {
  const order = claimEditorOrders()[0];
  const verified = status === "WAIT_FOR_COLLECTION" || status === "COLLECTED";
  return {
    id: `fixture-${status.toLowerCase()}`,
    expenseMonth: new Date("2026-09-01T00:00:00.000Z"),
    userId: claimantId,
    claimantPositionAtSubmission: "พชง. (อส) 5",
    selectedDates,
    countDates: selectedDates.length,
    amount: selectedDates.length * 150,
    remark: "ข้อมูลจำลองสำหรับตรวจสอบการแก้ไขวันที่",
    createdById: claimantId,
    createdAt: new Date("2026-09-20T03:00:00.000Z"),
    status,
    updatedAt: null,
    cancelledAt: null,
    monthlyRequestCollectionId: status === "COLLECTED" ? "fixture-monthly-collection" : null,
    collectedAt: status === "COLLECTED" ? new Date("2026-09-23T03:00:00.000Z") : null,
    claimant,
    createdBy: claimant,
    expenseClaimOffSiteWorks: [{
      offSiteWorkId: order.id,
      offSiteWork: {
        id: order.id,
        innerRefDocumentId: order.innerRefDocumentId,
        startDate: order.startDate,
        endDate: order.endDate,
        location: order.location,
        objective: order.objective,
        leaderUserId: "fixture-leader",
        leaderEmpId: "TEST-002",
        leaderFirstName: order.leaderFirstName,
        leaderLastName: order.leaderLastName,
        leaderPosition: "หัวหน้าชุด",
        leaderEmail: null,
      },
    }],
    leaderVerifications: status === "DRAFT" ? [] : [{
      id: `verification-${status.toLowerCase()}`,
      offSiteWorkId: order.id,
      leaderUserId: "fixture-leader",
      leaderEmail: null,
      token: "fixture-token-no-access",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
      verifiedAt: verified ? new Date("2026-09-22T03:00:00.000Z") : null,
    }],
  };
}

export const claimEditorItems = [
  makeClaim("DRAFT"),
  makeClaim("PENDING_LEADER_VERIFY"),
  makeClaim("WAIT_FOR_COLLECTION"),
  makeClaim("COLLECTED"),
];

export const claimEditorPagination: Pagination = {
  page: 1, pageSize: 20, total: claimEditorItems.length,
  totalPages: 1, hasNext: false, hasPrevious: false,
};

const successfulMutation = async () => ({ success: true as const, data: claimEditorItems[0] });
export const createExpenseClaimDocument = successfulMutation;
export const updateExpenseClaimDocument = successfulMutation;
export const deleteExpenseClaimDocument = successfulMutation;
export const submitDraftExpenseClaimDocument = successfulMutation;
export const listExpenseClaimDocuments = async () => ({
  success: true as const,
  data: { data: claimEditorItems, pagination: claimEditorPagination },
});
export const getExpenseClaimDocument = async (id: string) => {
  const data = claimEditorItems.find((item) => item.id === id);
  return data
    ? { success: true as const, data }
    : { success: false as const, error: "ไม่พบเอกสารตัวอย่าง" };
};
export const listEligibleOffSiteWorksForClaim = async (month?: string) => ({
  success: true as const,
  data: claimEditorOrders(month),
});
export const refreshVerificationToken = async () => ({
  success: false as const, error: "ข้อมูลจำลอง ไม่สามารถส่งลิงก์จริงได้",
});

const query = new URLSearchParams();
const router = { push: () => {}, replace: () => {}, refresh: () => {} };
export const useSearchParams = () => query;
export const useRouter = () => router;
export const usePathname = () => "/";
const permissions = {
  userId: claimantId,
  allows: (_action: string, ownerId?: string | null) => !ownerId || ownerId === claimantId,
};
export const useScopedPermission = () => permissions;
