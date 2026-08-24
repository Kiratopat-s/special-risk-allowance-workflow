/**
 * Shared Types - Domain Enums
 * 
 * Re-exports Prisma enums for use across the application
 * These enums are the single source of truth for domain constants
 * 
 * @module lib/shared/types/enums
 */

// Re-export from Prisma generated types
export {
    UserStatus,
    ActionType,
    ExpenseClaimStatus,
    ExpenseClaimRevisionStatus,
    WorkDayType,
    HolidayType,
    HolidaySource,
    HolidaySyncStatus,
    ClaimReviewFlagStatus,
    LeaderVerificationStatus,
    MonthlyRequestStatus,
    PermissionResource,
    PermissionAction,
    PermissionScope,
    NotificationType,
} from "@/lib/generated/prisma/client";
