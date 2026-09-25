/**
 * LeaderVerification Domain - Entity Types
 *
 * @module lib/domains/leader-verification/types
 */

export interface LeaderVerificationEntity {
    id: string;
    expenseClaimId: string;
    offSiteWorkId: string;
    leaderUserId: string | null;
    leaderEmail: string | null;
    token: string;
    expiresAt: Date;
    verifiedAt: Date | null;
    createdAt: Date;
}

export interface LeaderVerificationWithRelations extends LeaderVerificationEntity {
    expenseClaim: {
        id: string;
        expenseMonth: Date;
        userId: string;
        claimantPositionAtSubmission: string;
        status: string;
        claimant: {
            id: string;
            firstName: string;
            lastName: string;
            employeeId: string | null;
        };
    };
    offSiteWork: {
        id: string;
        innerRefDocumentId: string | null;
        startDate: Date;
        endDate: Date;
        location: string | null;
        objective: string | null;
        leaderFirstName: string | null;
        leaderLastName: string | null;
        leaderPosition: string | null;
        leaderEmpId: string | null;
    };
    leaderUser: {
        id: string;
        firstName: string;
        lastName: string;
        employeeId: string | null;
    } | null;
}

/** Read-only claim fields permitted in an assigned leader's internal queue. */
interface LeaderClaimSummary {
    id: string;
    expenseMonth: Date;
    claimantPositionAtSubmission: string;
    status: string;
    selectedDates: string[] | null;
    countDates: number | null;
    amount: number | null;
    claimant: LeaderVerificationWithRelations["expenseClaim"]["claimant"];
}

/** Internal queue projection, deliberately separate from public token records. */
export interface LeaderVerificationQueueItem {
    id: string;
    expenseClaimId: string;
    offSiteWorkId: string;
    expiresAt: Date;
    verifiedAt: Date | null;
    createdAt: Date;
    expenseClaim: LeaderClaimSummary;
    offSiteWork: LeaderVerificationWithRelations["offSiteWork"];
}

/** Claim details available through an assigned verification, without sharing controls. */
export interface LeaderClaimDetail extends LeaderClaimSummary {
    remark: string | null;
    expenseClaimOffSiteWorks: Array<{
        offSiteWorkId: string;
        offSiteWork: Pick<LeaderVerificationWithRelations["offSiteWork"],
            "id" | "innerRefDocumentId" | "startDate" | "endDate" | "location" | "objective">;
    }>;
}

/** Public review data granted by a current token, without sharing or account data. */
export type TokenVerificationView = {
    state: "ready";
    id: string;
    offSiteWorkId: string;
    expiresAt: Date;
    expenseClaim: Omit<LeaderClaimDetail, "claimant"> & {
        claimant: Pick<LeaderClaimDetail["claimant"], "firstName" | "lastName" | "employeeId">;
    };
    offSiteWork: Omit<LeaderVerificationWithRelations["offSiteWork"], "leaderEmpId">;
} | {
    state: "already_verified";
    offSiteWorkId: string;
    verifiedAt: Date;
};

export interface CreateLeaderVerificationInput {
    expenseClaimId: string;
    offSiteWorkId: string;
    leaderUserId?: string | null;
    leaderEmail?: string | null;
    expiresAt: Date;
}
