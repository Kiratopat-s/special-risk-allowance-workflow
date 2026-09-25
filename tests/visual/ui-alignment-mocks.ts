import { useState } from "react";
import { alignmentDepartments, alignmentNotifications, alignmentPermissions, alignmentRoles, alignmentUsers } from "../fixtures/ui-alignment";
import { leaderQueueClaimDetail, secondLeaderQueueClaimDetail } from "../fixtures/leader-queue";
import { tokenVerificationReady } from "../fixtures/token-verification";

// Browser fixture entrypoints never import authentication, actions, or the database.
const disabledMutation = async () => ({ success: false, error: "Visual fixture: saving is disabled" });
export const createRole = disabledMutation;
export const setRolePermissions = disabledMutation;
export const assignRoleToUser = disabledMutation;
export const revokeRoleFromUser = disabledMutation;
export const createDepartment = disabledMutation;
export const updateDepartment = disabledMutation;
export const deleteDepartment = disabledMutation;
export const toggleDepartmentStatus = disabledMutation;
export const cancelMonthlyRequestCollection = disabledMutation;
export const createMonthlyRequestCollection = disabledMutation;
export const reviewMonthlyRequestCollectionStep = disabledMutation;
export const submitMonthlyRequestCollection = disabledMutation;
export const updateMonthlyRequestCollection = disabledMutation;
export const createOffSiteWork = disabledMutation;
export const updateOffSiteWork = disabledMutation;
export const deleteOffSiteWork = disabledMutation;
export const verifyAsLeader = disabledMutation;
export const verifyByToken = disabledMutation;
export const getVerificationByToken = async () => ({ success: true, data: {
  ...tokenVerificationReady,
  expenseClaim: {
    ...tokenVerificationReady.expenseClaim,
    // Exercise multi-line notes and long words in the narrow external review layout.
    remark: "ข้อมูลจำลองสำหรับตรวจสอบหน้าจอ: ผู้ยื่นขอเบิกเฉพาะวันที่เลือกไว้ในปฏิทิน โดยมีคำสั่งปฏิบัติงานหลายฉบับและช่วงวันที่ทับซ้อนกัน กรุณาตรวจสอบรายละเอียดทั้งหมดก่อนลงนาม\nเลขอ้างอิงตัวอย่าง: EXTERNAL-REVIEW-REFERENCE-WITH-A-LONG-UNBROKEN-IDENTIFIER-1234567890",
  },
} });
export const getMyVerificationClaimDetail = async (claimId: string) => ({ success: true, data: claimId === leaderQueueClaimDetail.id ? leaderQueueClaimDetail : secondLeaderQueueClaimDetail });
export const listOffSiteWorks = async () => ({ success: true, data: { data: [], pagination: null } });
export const searchUsersForLeader = async () => ({ success: true, data: [] });
export const matchOffSiteWorkEmployees = async () => ({ success: true, data: [] });
export const getRole = async () => ({ success: true, data: { ...alignmentRoles[0], permissions: [alignmentPermissions[0]] } });
export const listUsersWithRoles = async () => ({ success: true, data: alignmentUsers });
export const listAllDepartments = async () => ({ success: true, data: alignmentDepartments });
export const listMonthlyRequestCollections = async () => ({ success: true, data: { data: [], pagination: null } });
export const listEligibleExpenseClaimsForMonth = async () => ({
  success: true,
  data: ["PENDING", "PENDING_LEADER_VERIFY", "WAIT_FOR_COLLECTION"].map((status, i) => ({
    id: "claim-fixture-" + i,
    status,
    isVerified: status === "WAIT_FOR_COLLECTION",
    countDates: "12",
    amount: "1800",
    claimantPositionAtSubmission: "ผู้ตรวจสอบการปฏิบัติงานประจำหน่วยงาน",
    claimant: { firstName: alignmentUsers[0].firstName, lastName: alignmentUsers[0].lastName },
  })),
});
export const useSearchParams = () => new URLSearchParams();
export const usePathname = () => "/";
export const useRouter = () => ({ push: () => {}, replace: () => {}, refresh: () => {} });
export const useUrlFilter = (_key: string, fallback = "") => useState(fallback);
export const useScopedPermission = () => ({ userId: "user-fixture", allows: () => true });
export const useNotifications = () => ({
  notifications: alignmentNotifications,
  unreadCount: 1,
  isLoading: false,
  markRead: disabledMutation,
  markAllRead: disabledMutation,
  clearOne: disabledMutation,
  clearAllRead: disabledMutation,
});
export const usePushSubscription = () => ({ permission: "denied", isLoading: false, subscribe: disabledMutation });
