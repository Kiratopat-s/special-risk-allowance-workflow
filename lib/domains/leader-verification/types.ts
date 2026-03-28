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

export interface CreateLeaderVerificationInput {
    expenseClaimId: string;
    offSiteWorkId: string;
    leaderUserId?: string | null;
    leaderEmail?: string | null;
    expiresAt: Date;
}
