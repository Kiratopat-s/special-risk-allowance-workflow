-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'SESSION_REFRESH', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_STATUS_CHANGED', 'PROFILE_VIEWED', 'PROFILE_UPDATED', 'PASSWORD_CHANGED', 'DEPARTMENT_CREATED', 'DEPARTMENT_UPDATED', 'DEPARTMENT_DELETED', 'SYSTEM_ACCESS', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'CLAIM_DRAFT_SAVED', 'CLAIM_SUBMITTED', 'CLAIM_CORRECTION_STARTED', 'CLAIM_RESUBMITTED', 'CLAIM_CANCELLED', 'CLAIM_REJECTED', 'CLAIM_COLLECTED', 'CLAIM_REMOVED_FROM_COLLECTION', 'CLAIM_SUSPICIOUS_MARKED', 'CLAIM_SUSPICIOUS_RESOLVED', 'LEADER_VERIFICATION_CONFIRMED', 'MRC_FINALIZED', 'MRC_ALL_DONE_RECORDED', 'MRC_DRAFT_CANCELLED', 'MRC_VOIDED', 'MRC_PREVIEW_RENDERED', 'MRC_OFFICIAL_RENDERED', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'PENDING_LEADER_CONFIRMATION', 'READY_FOR_COLLECTION', 'COLLECTED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseClaimRevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "WorkDayType" AS ENUM ('DUTY', 'TRAVEL');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('WORKDAY', 'WEEKEND', 'PUBLIC_HOLIDAY', 'FALLBACK_WORKDAY');

-- CreateEnum
CREATE TYPE "HolidaySource" AS ENUM ('GOOGLE', 'CALCULATED', 'MANUAL', 'FALLBACK');

-- CreateEnum
CREATE TYPE "HolidaySyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ClaimReviewFlagStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MonthlyRequestStatus" AS ENUM ('DRAFT', 'FINALIZED', 'ALL_DONE', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PermissionResource" AS ENUM ('USER', 'DEPARTMENT', 'ROLE', 'PERMISSION', 'EXPENSE_CLAIM', 'OFF_SITE_WORK', 'MONTHLY_REQUEST', 'SIGNATURE', 'FILE', 'ACTION_LOG', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LIST', 'EXPORT', 'IMPORT', 'APPROVE', 'REJECT', 'SUBMIT', 'CANCEL', 'RECHECK', 'COLLECT', 'REMOVE', 'FLAG', 'RESOLVE', 'FINALIZE', 'COMPLETE', 'VOID', 'PRINT', 'MANAGE');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('OWN', 'DEPARTMENT', 'ALL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MRC_FINALIZED', 'MRC_ALL_DONE', 'MRC_CANCELLED', 'MRC_VOIDED', 'CLAIM_STATUS_CHANGED', 'CLAIM_REJECTED', 'LEADER_VERIFY_REQUEST', 'OFF_SITE_WORK_UPDATED', 'SYSTEM_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "LeaderVerificationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "keycloak_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pea_email" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "employee_id" TEXT,
    "position" TEXT,
    "position_short" TEXT,
    "position_level" TEXT,
    "department_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "description" TEXT,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_action_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "action_description" TEXT,
    "target_user_id" TEXT,
    "target_department_id" TEXT,
    "target_entity_type" TEXT,
    "target_entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_path" TEXT,
    "request_method" TEXT,
    "metadata" JSONB,
    "previous_data" JSONB,
    "new_data" JSONB,
    "is_success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "off_site_works" (
    "id" TEXT NOT NULL,
    "inner_ref_document_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "objective" TEXT,
    "location" TEXT,
    "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by_user_id" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),
    "original_file_id" TEXT,
    "supersedes_id" TEXT,
    "leader_user_id" TEXT,
    "leader_emp_id" TEXT,
    "leader_first_name" TEXT,
    "leader_last_name" TEXT,
    "leader_position" TEXT,
    "leader_email" TEXT,

    CONSTRAINT "off_site_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "off_site_work_participants" (
    "off_site_work_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_id_snapshot" TEXT,
    "first_name_snapshot" TEXT NOT NULL,
    "last_name_snapshot" TEXT NOT NULL,
    "position_snapshot" TEXT,
    "position_short_snapshot" TEXT,
    "position_level_snapshot" TEXT,
    "department_id_snapshot" TEXT,
    "department_name_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "off_site_work_participants_pkey" PRIMARY KEY ("off_site_work_id","user_id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER,
    "file_content" BYTEA,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" TEXT NOT NULL,
    "expense_month" DATE NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "current_revision_no" INTEGER NOT NULL DEFAULT 1,
    "collected_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "rejected_by_id" TEXT,
    "rejection_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim_revisions" (
    "id" TEXT NOT NULL,
    "expense_claim_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "status" "ExpenseClaimRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "employee_id_snapshot" TEXT NOT NULL,
    "first_name_snapshot" TEXT NOT NULL,
    "last_name_snapshot" TEXT NOT NULL,
    "position_snapshot" TEXT,
    "position_short_snapshot" TEXT NOT NULL,
    "position_level_snapshot" TEXT,
    "department_id_snapshot" TEXT NOT NULL,
    "department_name_snapshot" TEXT NOT NULL,
    "department_short_snapshot" TEXT,
    "rate_per_day" DECIMAL(12,2) NOT NULL DEFAULT 150,
    "total_days" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "material_hash" CHAR(64),
    "submitted_at" TIMESTAMPTZ(3),
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_claim_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim_revision_off_site_works" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "off_site_work_id" TEXT NOT NULL,
    "inner_ref_document_id_snapshot" TEXT,
    "start_date_snapshot" DATE NOT NULL,
    "end_date_snapshot" DATE NOT NULL,
    "objective_snapshot" TEXT,
    "location_snapshot" TEXT,
    "leader_user_id_snapshot" TEXT,
    "leader_emp_id_snapshot" TEXT,
    "leader_first_name_snapshot" TEXT NOT NULL,
    "leader_last_name_snapshot" TEXT NOT NULL,
    "leader_position_snapshot" TEXT,
    "leader_email_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_claim_revision_off_site_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim_work_dates" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "revision_off_site_work_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "day_type" "WorkDayType" NOT NULL,
    "holiday_type" "HolidayType" NOT NULL,
    "holiday_name" TEXT,
    "holiday_source" "HolidaySource" NOT NULL,
    "requires_we_safe" BOOLEAN NOT NULL DEFAULT false,
    "daily_rate" DECIMAL(12,2) NOT NULL DEFAULT 150,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_claim_work_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim_work_date_we_safe_codes" (
    "id" TEXT NOT NULL,
    "work_date_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_claim_work_date_we_safe_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_calendar_dates" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "source" "HolidaySource" NOT NULL,
    "source_reference" TEXT,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_calendar_dates_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "holiday_calendar_syncs" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provider" "HolidaySource" NOT NULL,
    "status" "HolidaySyncStatus" NOT NULL,
    "last_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_success_at" TIMESTAMPTZ(3),
    "error_message" TEXT,

    CONSTRAINT "holiday_calendar_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_review_flags" (
    "id" TEXT NOT NULL,
    "expense_claim_id" TEXT NOT NULL,
    "status" "ClaimReviewFlagStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT NOT NULL,
    "opened_by_id" TEXT NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution_note" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "claim_review_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_request_collections" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "collector_id" TEXT NOT NULL,
    "collect_for_month" DATE NOT NULL,
    "batch_no" INTEGER,
    "status" "MonthlyRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "claim_count" INTEGER NOT NULL DEFAULT 0,
    "count_dates" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "snapshot_hash" CHAR(64),
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by_id" TEXT,
    "paper_approved_at" TIMESTAMPTZ(3),
    "all_done_note" TEXT,
    "all_done_at" TIMESTAMPTZ(3),
    "all_done_by_id" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monthly_request_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_request_collection_items" (
    "id" TEXT NOT NULL,
    "monthly_request_collection_id" TEXT NOT NULL,
    "expense_claim_id" TEXT NOT NULL,
    "claim_revision_id" TEXT NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_by_id" TEXT,
    "removed_at" TIMESTAMPTZ(3),
    "removal_reason" TEXT,
    "row_no" INTEGER,
    "employee_id_snapshot" TEXT,
    "first_name_snapshot" TEXT,
    "last_name_snapshot" TEXT,
    "position_short_snapshot" TEXT,
    "position_level_snapshot" TEXT,
    "department_id_snapshot" TEXT,
    "department_name_snapshot" TEXT,
    "department_short_snapshot" TEXT,
    "day_count_snapshot" INTEGER,
    "amount_snapshot" DECIMAL(12,2),
    "remark_snapshot" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_request_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_request_item_dates" (
    "id" TEXT NOT NULL,
    "monthly_request_item_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "off_site_work_id_snapshot" TEXT NOT NULL,
    "off_site_work_ref_snapshot" TEXT,
    "day_type" "WorkDayType" NOT NULL,
    "holiday_type" "HolidayType" NOT NULL,
    "holiday_name" TEXT,
    "daily_rate" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "monthly_request_item_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_request_item_date_we_safe_codes" (
    "id" TEXT NOT NULL,
    "monthly_request_item_date_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "monthly_request_item_date_we_safe_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrc_replacement_sources" (
    "replacement_draft_id" TEXT NOT NULL,
    "voided_mrc_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mrc_replacement_sources_pkey" PRIMARY KEY ("replacement_draft_id","voided_mrc_id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature_data" BYTEA NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" "PermissionResource" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'OWN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "parent_role_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "department_id" TEXT,
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "granted_by_id" TEXT,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_verifications" (
    "id" TEXT NOT NULL,
    "claim_revision_id" TEXT NOT NULL,
    "revision_off_site_work_id" TEXT NOT NULL,
    "status" "LeaderVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "leader_user_id" TEXT,
    "leader_emp_id_snapshot" TEXT,
    "leader_first_name_snapshot" TEXT NOT NULL,
    "leader_last_name_snapshot" TEXT NOT NULL,
    "leader_position_snapshot" TEXT,
    "leader_email_snapshot" TEXT,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "payload_snapshot" JSONB NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "signature_data" BYTEA,
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloak_id_key" ON "users"("keycloak_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_keycloak_id_idx" ON "users"("keycloak_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");

-- CreateIndex
CREATE INDEX "users_employee_id_idx" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_short_name_key" ON "departments"("short_name");

-- CreateIndex
CREATE INDEX "departments_name_idx" ON "departments"("name");

-- CreateIndex
CREATE INDEX "departments_short_name_idx" ON "departments"("short_name");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "user_action_logs_user_id_idx" ON "user_action_logs"("user_id");

-- CreateIndex
CREATE INDEX "user_action_logs_action_type_idx" ON "user_action_logs"("action_type");

-- CreateIndex
CREATE INDEX "user_action_logs_target_user_id_idx" ON "user_action_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "user_action_logs_target_department_id_idx" ON "user_action_logs"("target_department_id");

-- CreateIndex
CREATE INDEX "user_action_logs_created_at_idx" ON "user_action_logs"("created_at");

-- CreateIndex
CREATE INDEX "user_action_logs_is_success_idx" ON "user_action_logs"("is_success");

-- CreateIndex
CREATE INDEX "user_action_logs_target_entity_type_target_entity_id_create_idx" ON "user_action_logs"("target_entity_type", "target_entity_id", "created_at");

-- CreateIndex
CREATE INDEX "off_site_works_posted_by_user_id_idx" ON "off_site_works"("posted_by_user_id");

-- CreateIndex
CREATE INDEX "off_site_works_original_file_id_idx" ON "off_site_works"("original_file_id");

-- CreateIndex
CREATE INDEX "off_site_works_start_date_idx" ON "off_site_works"("start_date");

-- CreateIndex
CREATE INDEX "off_site_works_end_date_idx" ON "off_site_works"("end_date");

-- CreateIndex
CREATE INDEX "off_site_works_deleted_at_idx" ON "off_site_works"("deleted_at");

-- CreateIndex
CREATE INDEX "off_site_works_posted_at_idx" ON "off_site_works"("posted_at");

-- CreateIndex
CREATE INDEX "off_site_works_leader_user_id_idx" ON "off_site_works"("leader_user_id");

-- CreateIndex
CREATE INDEX "off_site_works_supersedes_id_idx" ON "off_site_works"("supersedes_id");

-- CreateIndex
CREATE INDEX "off_site_work_participants_user_id_idx" ON "off_site_work_participants"("user_id");

-- CreateIndex
CREATE INDEX "off_site_work_participants_department_id_snapshot_idx" ON "off_site_work_participants"("department_id_snapshot");

-- CreateIndex
CREATE INDEX "files_uploaded_by_id_idx" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "files_deleted_at_idx" ON "files"("deleted_at");

-- CreateIndex
CREATE INDEX "files_uploaded_at_idx" ON "files"("uploaded_at");

-- CreateIndex
CREATE INDEX "expense_claims_user_id_idx" ON "expense_claims"("user_id");

-- CreateIndex
CREATE INDEX "expense_claims_created_by_id_idx" ON "expense_claims"("created_by_id");

-- CreateIndex
CREATE INDEX "expense_claims_expense_month_idx" ON "expense_claims"("expense_month");

-- CreateIndex
CREATE INDEX "expense_claims_status_idx" ON "expense_claims"("status");

-- CreateIndex
CREATE INDEX "expense_claims_created_at_idx" ON "expense_claims"("created_at");

-- CreateIndex
CREATE INDEX "expense_claims_user_id_expense_month_idx" ON "expense_claims"("user_id", "expense_month");

-- CreateIndex
CREATE INDEX "expense_claims_status_expense_month_idx" ON "expense_claims"("status", "expense_month");

-- CreateIndex
CREATE INDEX "expense_claim_revisions_expense_claim_id_status_idx" ON "expense_claim_revisions"("expense_claim_id", "status");

-- CreateIndex
CREATE INDEX "expense_claim_revisions_department_id_snapshot_idx" ON "expense_claim_revisions"("department_id_snapshot");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claim_revisions_expense_claim_id_revision_no_key" ON "expense_claim_revisions"("expense_claim_id", "revision_no");

-- CreateIndex
CREATE INDEX "expense_claim_revision_off_site_works_off_site_work_id_idx" ON "expense_claim_revision_off_site_works"("off_site_work_id");

-- CreateIndex
CREATE INDEX "expense_claim_revision_off_site_works_revision_id_idx" ON "expense_claim_revision_off_site_works"("revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claim_revision_off_site_works_revision_id_off_site__key" ON "expense_claim_revision_off_site_works"("revision_id", "off_site_work_id");

-- CreateIndex
CREATE INDEX "expense_claim_work_dates_revision_off_site_work_id_work_dat_idx" ON "expense_claim_work_dates"("revision_off_site_work_id", "work_date");

-- CreateIndex
CREATE INDEX "expense_claim_work_dates_work_date_idx" ON "expense_claim_work_dates"("work_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claim_work_dates_revision_id_work_date_key" ON "expense_claim_work_dates"("revision_id", "work_date");

-- CreateIndex
CREATE INDEX "expense_claim_work_date_we_safe_codes_work_date_id_idx" ON "expense_claim_work_date_we_safe_codes"("work_date_id");

-- CreateIndex
CREATE INDEX "holiday_calendar_dates_source_idx" ON "holiday_calendar_dates"("source");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendar_syncs_year_provider_key" ON "holiday_calendar_syncs"("year", "provider");

-- CreateIndex
CREATE INDEX "claim_review_flags_expense_claim_id_status_idx" ON "claim_review_flags"("expense_claim_id", "status");

-- CreateIndex
CREATE INDEX "claim_review_flags_opened_by_id_idx" ON "claim_review_flags"("opened_by_id");

-- CreateIndex
CREATE INDEX "monthly_request_collections_collector_id_idx" ON "monthly_request_collections"("collector_id");

-- CreateIndex
CREATE INDEX "monthly_request_collections_department_id_idx" ON "monthly_request_collections"("department_id");

-- CreateIndex
CREATE INDEX "monthly_request_collections_collect_for_month_idx" ON "monthly_request_collections"("collect_for_month");

-- CreateIndex
CREATE INDEX "monthly_request_collections_status_idx" ON "monthly_request_collections"("status");

-- CreateIndex
CREATE INDEX "monthly_request_collections_created_at_idx" ON "monthly_request_collections"("created_at");

-- CreateIndex
CREATE INDEX "monthly_request_collections_department_id_collect_for_month_idx" ON "monthly_request_collections"("department_id", "collect_for_month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_request_collections_department_id_collect_for_month_key" ON "monthly_request_collections"("department_id", "collect_for_month", "batch_no");

-- CreateIndex
CREATE INDEX "monthly_request_collection_items_expense_claim_id_removed_a_idx" ON "monthly_request_collection_items"("expense_claim_id", "removed_at");

-- CreateIndex
CREATE INDEX "monthly_request_collection_items_claim_revision_id_idx" ON "monthly_request_collection_items"("claim_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_request_collection_items_monthly_request_collection_key" ON "monthly_request_collection_items"("monthly_request_collection_id", "expense_claim_id");

-- CreateIndex
CREATE INDEX "monthly_request_item_dates_work_date_idx" ON "monthly_request_item_dates"("work_date");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_request_item_dates_monthly_request_item_id_work_dat_key" ON "monthly_request_item_dates"("monthly_request_item_id", "work_date");

-- CreateIndex
CREATE INDEX "monthly_request_item_date_we_safe_codes_monthly_request_ite_idx" ON "monthly_request_item_date_we_safe_codes"("monthly_request_item_date_id");

-- CreateIndex
CREATE INDEX "mrc_replacement_sources_voided_mrc_id_idx" ON "mrc_replacement_sources"("voided_mrc_id");

-- CreateIndex
CREATE INDEX "signatures_deleted_at_idx" ON "signatures"("deleted_at");

-- CreateIndex
CREATE INDEX "signatures_user_id_deleted_at_idx" ON "signatures"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "signatures_user_id_is_active_deleted_at_idx" ON "signatures"("user_id", "is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "permissions"("resource");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "permissions_code_idx" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_is_active_idx" ON "permissions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_code_idx" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_level_idx" ON "roles"("level");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE INDEX "roles_parent_role_id_idx" ON "roles"("parent_role_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_department_id_idx" ON "user_roles"("department_id");

-- CreateIndex
CREATE INDEX "user_roles_is_active_idx" ON "user_roles"("is_active");

-- CreateIndex
CREATE INDEX "user_roles_expires_at_idx" ON "user_roles"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_department_id_key" ON "user_roles"("user_id", "role_id", "department_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leader_verifications_revision_off_site_work_id_key" ON "leader_verifications"("revision_off_site_work_id");

-- CreateIndex
CREATE UNIQUE INDEX "leader_verifications_token_hash_key" ON "leader_verifications"("token_hash");

-- CreateIndex
CREATE INDEX "leader_verifications_claim_revision_id_idx" ON "leader_verifications"("claim_revision_id");

-- CreateIndex
CREATE INDEX "leader_verifications_leader_user_id_idx" ON "leader_verifications"("leader_user_id");

-- CreateIndex
CREATE INDEX "leader_verifications_token_hash_idx" ON "leader_verifications"("token_hash");

-- CreateIndex
CREATE INDEX "leader_verifications_status_confirmed_at_idx" ON "leader_verifications"("status", "confirmed_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_target_department_id_fkey" FOREIGN KEY ("target_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "off_site_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_work_participants" ADD CONSTRAINT "off_site_work_participants_off_site_work_id_fkey" FOREIGN KEY ("off_site_work_id") REFERENCES "off_site_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_work_participants" ADD CONSTRAINT "off_site_work_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_revisions" ADD CONSTRAINT "expense_claim_revisions_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_revision_off_site_works" ADD CONSTRAINT "expense_claim_revision_off_site_works_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "expense_claim_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_revision_off_site_works" ADD CONSTRAINT "expense_claim_revision_off_site_works_off_site_work_id_fkey" FOREIGN KEY ("off_site_work_id") REFERENCES "off_site_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_work_dates" ADD CONSTRAINT "expense_claim_work_dates_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "expense_claim_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_work_dates" ADD CONSTRAINT "expense_claim_work_dates_revision_off_site_work_id_fkey" FOREIGN KEY ("revision_off_site_work_id") REFERENCES "expense_claim_revision_off_site_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_work_date_we_safe_codes" ADD CONSTRAINT "expense_claim_work_date_we_safe_codes_work_date_id_fkey" FOREIGN KEY ("work_date_id") REFERENCES "expense_claim_work_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_review_flags" ADD CONSTRAINT "claim_review_flags_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_review_flags" ADD CONSTRAINT "claim_review_flags_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_review_flags" ADD CONSTRAINT "claim_review_flags_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_all_done_by_id_fkey" FOREIGN KEY ("all_done_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collection_items" ADD CONSTRAINT "monthly_request_collection_items_monthly_request_collectio_fkey" FOREIGN KEY ("monthly_request_collection_id") REFERENCES "monthly_request_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collection_items" ADD CONSTRAINT "monthly_request_collection_items_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collection_items" ADD CONSTRAINT "monthly_request_collection_items_claim_revision_id_fkey" FOREIGN KEY ("claim_revision_id") REFERENCES "expense_claim_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collection_items" ADD CONSTRAINT "monthly_request_collection_items_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collection_items" ADD CONSTRAINT "monthly_request_collection_items_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_item_dates" ADD CONSTRAINT "monthly_request_item_dates_monthly_request_item_id_fkey" FOREIGN KEY ("monthly_request_item_id") REFERENCES "monthly_request_collection_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_item_date_we_safe_codes" ADD CONSTRAINT "monthly_request_item_date_we_safe_codes_monthly_request_it_fkey" FOREIGN KEY ("monthly_request_item_date_id") REFERENCES "monthly_request_item_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrc_replacement_sources" ADD CONSTRAINT "mrc_replacement_sources_replacement_draft_id_fkey" FOREIGN KEY ("replacement_draft_id") REFERENCES "monthly_request_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrc_replacement_sources" ADD CONSTRAINT "mrc_replacement_sources_voided_mrc_id_fkey" FOREIGN KEY ("voided_mrc_id") REFERENCES "monthly_request_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_claim_revision_id_fkey" FOREIGN KEY ("claim_revision_id") REFERENCES "expense_claim_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_revision_off_site_work_id_fkey" FOREIGN KEY ("revision_off_site_work_id") REFERENCES "expense_claim_revision_off_site_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Clean-break invariants that Prisma cannot express
-- =============================================================================

-- One logical active claim per claimant/month and one draft collection per scope.
CREATE UNIQUE INDEX "uq_active_claim_user_month"
ON "expense_claims" ("user_id", "expense_month")
WHERE "cancelled_at" IS NULL;

CREATE UNIQUE INDEX "uq_active_osw_replacement"
ON "off_site_works" ("supersedes_id")
WHERE "supersedes_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_draft_mrc_department_month"
ON "monthly_request_collections" ("department_id", "collect_for_month")
WHERE "status" = 'DRAFT';

CREATE UNIQUE INDEX "uq_active_mrc_item_claim"
ON "monthly_request_collection_items" ("expense_claim_id")
WHERE "removed_at" IS NULL;

CREATE UNIQUE INDEX "uq_active_mrc_row_no"
ON "monthly_request_collection_items" ("monthly_request_collection_id", "row_no")
WHERE "removed_at" IS NULL AND "row_no" IS NOT NULL;

CREATE UNIQUE INDEX "uq_open_claim_review_flag"
ON "claim_review_flags" ("expense_claim_id")
WHERE "status" = 'OPEN';

CREATE UNIQUE INDEX "uq_global_user_role"
ON "user_roles" ("user_id", "role_id")
WHERE "department_id" IS NULL;

-- Composite foreign keys prevent IDs from different revisions/claims being mixed.
ALTER TABLE "expense_claim_revision_off_site_works"
ADD CONSTRAINT "uq_rev_osw_id_revision"
UNIQUE ("id", "revision_id");

ALTER TABLE "expense_claim_revisions"
ADD CONSTRAINT "uq_revision_id_claim"
UNIQUE ("id", "expense_claim_id");

ALTER TABLE "expense_claim_work_dates"
ADD CONSTRAINT "fk_work_date_revision_osw_scope"
FOREIGN KEY ("revision_off_site_work_id", "revision_id")
REFERENCES "expense_claim_revision_off_site_works" ("id", "revision_id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "leader_verifications"
ADD CONSTRAINT "fk_leader_verification_revision_osw_scope"
FOREIGN KEY ("revision_off_site_work_id", "claim_revision_id")
REFERENCES "expense_claim_revision_off_site_works" ("id", "revision_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "monthly_request_collection_items"
ADD CONSTRAINT "fk_mrc_item_revision_claim_scope"
FOREIGN KEY ("claim_revision_id", "expense_claim_id")
REFERENCES "expense_claim_revisions" ("id", "expense_claim_id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "expense_claims"
ADD CONSTRAINT "fk_claim_current_revision"
FOREIGN KEY ("id", "current_revision_no")
REFERENCES "expense_claim_revisions" ("expense_claim_id", "revision_no")
DEFERRABLE INITIALLY DEFERRED;

-- Local shape and lifecycle checks.
ALTER TABLE "users"
ADD CONSTRAINT "ck_user_employee_id"
CHECK ("employee_id" IS NULL OR "employee_id" ~ '^[0-9]{1,6}$');

ALTER TABLE "departments"
ADD CONSTRAINT "ck_department_not_own_parent"
CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "off_site_works"
ADD CONSTRAINT "ck_osw_date_range"
CHECK ("start_date" <= "end_date"),
ADD CONSTRAINT "ck_osw_not_self_replacement"
CHECK ("supersedes_id" IS NULL OR "supersedes_id" <> "id"),
ADD CONSTRAINT "ck_osw_leader_employee_id"
CHECK ("leader_emp_id" IS NULL OR "leader_emp_id" ~ '^[0-9]{1,6}$');

ALTER TABLE "off_site_work_participants"
ADD CONSTRAINT "ck_osw_participant_employee_snapshot"
CHECK (
  "employee_id_snapshot" IS NULL
  OR "employee_id_snapshot" ~ '^[0-9]{6}$'
);

ALTER TABLE "expense_claims"
ADD CONSTRAINT "ck_claim_month_first_day"
CHECK (EXTRACT(DAY FROM "expense_month") = 1),
ADD CONSTRAINT "ck_claim_lifecycle_metadata"
CHECK (
  "current_revision_no" >= 1
  AND (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL))
  AND (
    ("status" IN ('COLLECTED', 'COMPLETED'))
    = ("collected_at" IS NOT NULL)
  )
  AND (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL))
  AND (
    (
      "rejected_at" IS NULL
      AND "rejected_by_id" IS NULL
      AND "rejection_reason" IS NULL
    )
    OR (
      "rejected_at" IS NOT NULL
      AND "rejected_by_id" IS NOT NULL
      AND "rejection_reason" IS NOT NULL
      AND BTRIM("rejection_reason") <> ''
    )
  )
  AND ("status" <> 'REJECTED' OR "rejected_at" IS NOT NULL)
  AND ("collected_at" IS NULL OR "collected_at" >= "created_at")
  AND (
    "completed_at" IS NULL
    OR ("collected_at" IS NOT NULL AND "completed_at" >= "collected_at")
  )
  AND ("rejected_at" IS NULL OR "rejected_at" >= "created_at")
  AND ("cancelled_at" IS NULL OR "cancelled_at" >= "created_at")
);

ALTER TABLE "expense_claim_revisions"
ADD CONSTRAINT "ck_revision_values"
CHECK (
  "revision_no" >= 1
  AND "rate_per_day" = 150.00
  AND "total_days" >= 0
  AND "total_amount" = "total_days" * "rate_per_day"
  AND (
    "material_hash" IS NULL
    OR "material_hash" ~ '^[0-9a-f]{64}$'
  )
  AND (
    "submitted_at" IS NULL
    OR (
      "employee_id_snapshot" ~ '^[0-9]{6}$'
      AND BTRIM("first_name_snapshot") <> ''
      AND BTRIM("last_name_snapshot") <> ''
      AND BTRIM("position_short_snapshot") <> ''
      AND BTRIM("department_id_snapshot") <> ''
      AND BTRIM("department_name_snapshot") <> ''
    )
  )
),
ADD CONSTRAINT "ck_revision_lifecycle"
CHECK (
  (
    "status" = 'DRAFT'
    AND "submitted_at" IS NULL
    AND "superseded_at" IS NULL
  )
  OR (
    "status" = 'SUBMITTED'
    AND "submitted_at" IS NOT NULL
    AND "superseded_at" IS NULL
    AND "total_days" > 0
    AND "material_hash" IS NOT NULL
  )
  OR (
    "status" = 'SUPERSEDED'
    AND "superseded_at" IS NOT NULL
    AND "superseded_at" >= "created_at"
    AND (
      "submitted_at" IS NULL
      OR (
        "superseded_at" >= "submitted_at"
        AND "total_days" > 0
        AND "material_hash" IS NOT NULL
      )
    )
  )
);

ALTER TABLE "expense_claim_revision_off_site_works"
ADD CONSTRAINT "ck_revision_osw_date_range"
CHECK ("start_date_snapshot" <= "end_date_snapshot"),
ADD CONSTRAINT "ck_revision_osw_leader_employee"
CHECK (
  "leader_emp_id_snapshot" IS NULL
  OR "leader_emp_id_snapshot" ~ '^[0-9]{6}$'
);

ALTER TABLE "expense_claim_work_dates"
ADD CONSTRAINT "ck_work_date_rate_and_wesafe"
CHECK (
  "daily_rate" = 150.00
  AND "requires_we_safe" = (
    "day_type" = 'TRAVEL'
    OR "holiday_type" IN ('WEEKEND', 'PUBLIC_HOLIDAY')
  )
),
ADD CONSTRAINT "ck_work_date_holiday_metadata"
CHECK (
  (
    "holiday_type" = 'PUBLIC_HOLIDAY'
    AND "holiday_name" IS NOT NULL
    AND BTRIM("holiday_name") <> ''
    AND "holiday_source" IN ('GOOGLE', 'MANUAL')
  )
  OR (
    "holiday_type" = 'WEEKEND'
    AND "holiday_name" IS NOT NULL
    AND BTRIM("holiday_name") <> ''
    AND "holiday_source" = 'CALCULATED'
  )
  OR (
    "holiday_type" = 'FALLBACK_WORKDAY'
    AND "holiday_name" IS NULL
    AND "holiday_source" = 'FALLBACK'
  )
  OR (
    "holiday_type" = 'WORKDAY'
    AND "holiday_name" IS NULL
    AND "holiday_source" = 'GOOGLE'
  )
);

ALTER TABLE "expense_claim_work_date_we_safe_codes"
ADD CONSTRAINT "ck_work_date_wesafe_code"
CHECK ("code" = BTRIM("code"));

ALTER TABLE "holiday_calendar_dates"
ADD CONSTRAINT "ck_holiday_calendar_entry"
CHECK (
  BTRIM("name") <> ''
  AND "source" IN ('GOOGLE', 'MANUAL')
);

ALTER TABLE "holiday_calendar_syncs"
ADD CONSTRAINT "ck_holiday_sync"
CHECK (
  "year" BETWEEN 2000 AND 9999
  AND "provider" = 'GOOGLE'
  AND ("last_success_at" IS NULL OR "last_success_at" <= "last_attempt_at")
  AND (
    (
      "status" = 'PENDING'
      AND "error_message" IS NULL
    )
    OR (
      "status" = 'SUCCESS'
      AND "last_success_at" IS NOT NULL
      AND "error_message" IS NULL
    )
    OR (
      "status" = 'FAILED'
      AND "error_message" IS NOT NULL
      AND BTRIM("error_message") <> ''
    )
  )
);

ALTER TABLE "claim_review_flags"
ADD CONSTRAINT "ck_claim_review_flag"
CHECK (
  BTRIM("note") <> ''
  AND (
    (
      "status" = 'OPEN'
      AND "resolution_note" IS NULL
      AND "resolved_by_id" IS NULL
      AND "resolved_at" IS NULL
    )
    OR (
      "status" = 'RESOLVED'
      AND "resolution_note" IS NOT NULL
      AND BTRIM("resolution_note") <> ''
      AND "resolved_by_id" IS NOT NULL
      AND "resolved_at" IS NOT NULL
      AND "resolved_at" >= "opened_at"
    )
  )
);

ALTER TABLE "monthly_request_collections"
ADD CONSTRAINT "ck_mrc_totals"
CHECK (
  EXTRACT(DAY FROM "collect_for_month") = 1
  AND "snapshot_version" >= 1
  AND "claim_count" >= 0
  AND "count_dates" >= 0
  AND "amount" = "count_dates" * 150.00
  AND ("batch_no" IS NULL OR "batch_no" >= 1)
  AND (
    "snapshot_hash" IS NULL
    OR "snapshot_hash" ~ '^[0-9a-f]{64}$'
  )
),
ADD CONSTRAINT "ck_mrc_lifecycle_metadata"
CHECK (
  (
    "status" = 'DRAFT'
    AND "batch_no" IS NULL
    AND "snapshot_hash" IS NULL
    AND "finalized_at" IS NULL
    AND "finalized_by_id" IS NULL
    AND "paper_approved_at" IS NULL
    AND "all_done_at" IS NULL
    AND "all_done_by_id" IS NULL
    AND "all_done_note" IS NULL
    AND "cancelled_at" IS NULL
    AND "cancelled_by_id" IS NULL
    AND "cancel_reason" IS NULL
    AND "voided_at" IS NULL
    AND "voided_by_id" IS NULL
    AND "void_reason" IS NULL
  )
  OR (
    "status" = 'FINALIZED'
    AND "batch_no" IS NOT NULL
    AND "snapshot_hash" IS NOT NULL
    AND "claim_count" > 0
    AND "count_dates" > 0
    AND "finalized_at" IS NOT NULL
    AND "finalized_by_id" IS NOT NULL
    AND "paper_approved_at" IS NULL
    AND "all_done_at" IS NULL
    AND "all_done_by_id" IS NULL
    AND "all_done_note" IS NULL
    AND "cancelled_at" IS NULL
    AND "cancelled_by_id" IS NULL
    AND "cancel_reason" IS NULL
    AND "voided_at" IS NULL
    AND "voided_by_id" IS NULL
    AND "void_reason" IS NULL
  )
  OR (
    "status" = 'ALL_DONE'
    AND "batch_no" IS NOT NULL
    AND "snapshot_hash" IS NOT NULL
    AND "claim_count" > 0
    AND "count_dates" > 0
    AND "finalized_at" IS NOT NULL
    AND "finalized_by_id" IS NOT NULL
    AND "paper_approved_at" IS NOT NULL
    AND "all_done_at" IS NOT NULL
    AND "all_done_by_id" IS NOT NULL
    AND "paper_approved_at" >= "finalized_at"
    AND "all_done_at" >= "paper_approved_at"
    AND "cancelled_at" IS NULL
    AND "cancelled_by_id" IS NULL
    AND "cancel_reason" IS NULL
    AND "voided_at" IS NULL
    AND "voided_by_id" IS NULL
    AND "void_reason" IS NULL
  )
  OR (
    "status" = 'CANCELLED'
    AND "batch_no" IS NULL
    AND "snapshot_hash" IS NULL
    AND "finalized_at" IS NULL
    AND "finalized_by_id" IS NULL
    AND "paper_approved_at" IS NULL
    AND "all_done_at" IS NULL
    AND "all_done_by_id" IS NULL
    AND "all_done_note" IS NULL
    AND "cancelled_at" IS NOT NULL
    AND "cancelled_by_id" IS NOT NULL
    AND "cancel_reason" IS NOT NULL
    AND BTRIM("cancel_reason") <> ''
    AND "voided_at" IS NULL
    AND "voided_by_id" IS NULL
    AND "void_reason" IS NULL
  )
  OR (
    "status" = 'VOIDED'
    AND "batch_no" IS NOT NULL
    AND "snapshot_hash" IS NOT NULL
    AND "claim_count" > 0
    AND "count_dates" > 0
    AND "finalized_at" IS NOT NULL
    AND "finalized_by_id" IS NOT NULL
    AND "cancelled_at" IS NULL
    AND "cancelled_by_id" IS NULL
    AND "cancel_reason" IS NULL
    AND "voided_at" IS NOT NULL
    AND "voided_by_id" IS NOT NULL
    AND "void_reason" IS NOT NULL
    AND BTRIM("void_reason") <> ''
    AND "voided_at" >= "finalized_at"
    AND (
      (
        "paper_approved_at" IS NULL
        AND "all_done_at" IS NULL
        AND "all_done_by_id" IS NULL
        AND "all_done_note" IS NULL
      )
      OR (
        "paper_approved_at" IS NOT NULL
        AND "all_done_at" IS NOT NULL
        AND "all_done_by_id" IS NOT NULL
        AND "paper_approved_at" >= "finalized_at"
        AND "all_done_at" >= "paper_approved_at"
        AND "voided_at" >= "all_done_at"
      )
    )
  )
);

ALTER TABLE "monthly_request_collection_items"
ADD CONSTRAINT "ck_mrc_item_snapshot"
CHECK (
  ("row_no" IS NULL OR "row_no" >= 1)
  AND "employee_id_snapshot" IS NOT NULL
  AND "employee_id_snapshot" ~ '^[0-9]{6}$'
  AND "first_name_snapshot" IS NOT NULL
  AND BTRIM("first_name_snapshot") <> ''
  AND "last_name_snapshot" IS NOT NULL
  AND BTRIM("last_name_snapshot") <> ''
  AND "position_short_snapshot" IS NOT NULL
  AND BTRIM("position_short_snapshot") <> ''
  AND "department_id_snapshot" IS NOT NULL
  AND BTRIM("department_id_snapshot") <> ''
  AND "department_name_snapshot" IS NOT NULL
  AND BTRIM("department_name_snapshot") <> ''
  AND "day_count_snapshot" IS NOT NULL
  AND "day_count_snapshot" > 0
  AND "amount_snapshot" IS NOT NULL
  AND "amount_snapshot" = "day_count_snapshot" * 150.00
  AND (
    (
      "removed_at" IS NULL
      AND "removed_by_id" IS NULL
      AND "removal_reason" IS NULL
    )
    OR (
      "removed_at" IS NOT NULL
      AND "removed_by_id" IS NOT NULL
      AND "removal_reason" IS NOT NULL
      AND BTRIM("removal_reason") <> ''
      AND "removed_at" >= "added_at"
    )
  )
);

ALTER TABLE "monthly_request_item_dates"
ADD CONSTRAINT "ck_mrc_item_date_rate"
CHECK (
  "daily_rate" = 150.00
  AND (
    ("holiday_type" = 'PUBLIC_HOLIDAY' AND "holiday_name" IS NOT NULL)
    OR ("holiday_type" = 'WEEKEND' AND "holiday_name" IS NOT NULL)
    OR ("holiday_type" IN ('WORKDAY', 'FALLBACK_WORKDAY') AND "holiday_name" IS NULL)
  )
);

ALTER TABLE "monthly_request_item_date_we_safe_codes"
ADD CONSTRAINT "ck_mrc_item_date_wesafe_code"
CHECK (CHAR_LENGTH("code") = 19 AND "code" = BTRIM("code"));

ALTER TABLE "mrc_replacement_sources"
ADD CONSTRAINT "ck_mrc_replacement_not_self"
CHECK ("replacement_draft_id" <> "voided_mrc_id");

ALTER TABLE "leader_verifications"
ADD CONSTRAINT "ck_leader_verification_hashes"
CHECK (
  "token_hash" ~ '^[0-9a-f]{64}$'
  AND "payload_hash" ~ '^[0-9a-f]{64}$'
  AND "expires_at" > "created_at"
  AND (
    "leader_emp_id_snapshot" IS NULL
    OR "leader_emp_id_snapshot" ~ '^[0-9]{6}$'
  )
),
ADD CONSTRAINT "ck_leader_verification_lifecycle"
CHECK (
  (
    "status" = 'PENDING'
    AND "confirmed_at" IS NULL
    AND "signature_data" IS NULL
    AND "superseded_at" IS NULL
  )
  OR (
    "status" = 'CONFIRMED'
    AND "confirmed_at" IS NOT NULL
    AND "confirmed_at" >= "created_at"
    AND "confirmed_at" <= "expires_at"
    AND "signature_data" IS NOT NULL
    AND OCTET_LENGTH("signature_data") > 0
    AND "superseded_at" IS NULL
  )
  OR (
    "status" = 'SUPERSEDED'
    AND "superseded_at" IS NOT NULL
    AND "superseded_at" >= "created_at"
    AND (
      (
        "confirmed_at" IS NULL
        AND "signature_data" IS NULL
      )
      OR (
        "confirmed_at" IS NOT NULL
        AND "signature_data" IS NOT NULL
        AND OCTET_LENGTH("signature_data") > 0
        AND "superseded_at" >= "confirmed_at"
      )
    )
  )
);

-- Validate claim dates against the exact revision/OSW/participant scope.
CREATE OR REPLACE FUNCTION "sraw_validate_work_date_scope"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_revision_id TEXT;
  v_start DATE;
  v_end DATE;
  v_expense_month DATE;
  v_claimant_id TEXT;
  v_osw_id TEXT;
  v_expected_day_type "WorkDayType";
BEGIN
  SELECT
    ros."revision_id",
    ros."start_date_snapshot",
    ros."end_date_snapshot",
    c."expense_month",
    c."user_id",
    ros."off_site_work_id"
  INTO
    v_revision_id,
    v_start,
    v_end,
    v_expense_month,
    v_claimant_id,
    v_osw_id
  FROM "expense_claim_revision_off_site_works" ros
  JOIN "expense_claim_revisions" r ON r."id" = ros."revision_id"
  JOIN "expense_claims" c ON c."id" = r."expense_claim_id"
  WHERE ros."id" = NEW."revision_off_site_work_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'revision off-site work not found';
  END IF;
  IF NEW."revision_id" <> v_revision_id THEN
    RAISE EXCEPTION 'work date revision does not match OSW snapshot revision';
  END IF;
  IF NEW."work_date" < v_start OR NEW."work_date" > v_end THEN
    RAISE EXCEPTION 'work date is outside OSW snapshot range';
  END IF;
  IF DATE_TRUNC('month', NEW."work_date")::DATE <> v_expense_month THEN
    RAISE EXCEPTION 'work date is outside expense month';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM "off_site_work_participants" p
    WHERE p."off_site_work_id" = v_osw_id
      AND p."user_id" = v_claimant_id
  ) THEN
    RAISE EXCEPTION 'claimant is not an OSW participant';
  END IF;

  v_expected_day_type :=
    CASE
      WHEN NEW."work_date" = v_start OR NEW."work_date" = v_end
        THEN 'TRAVEL'::"WorkDayType"
      ELSE 'DUTY'::"WorkDayType"
    END;
  IF NEW."day_type" <> v_expected_day_type THEN
    RAISE EXCEPTION 'work day type does not match OSW boundary rule';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_work_date_scope"
BEFORE INSERT OR UPDATE OF
  "revision_id",
  "revision_off_site_work_id",
  "work_date",
  "day_type"
ON "expense_claim_work_dates"
FOR EACH ROW
EXECUTE FUNCTION "sraw_validate_work_date_scope"();

-- Revision-owned date/OSW/code rows are mutable only while the revision is a draft.
CREATE OR REPLACE FUNCTION "sraw_require_draft_revision"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_revision_id TEXT;
  v_new_revision_id TEXT;
  v_old_status "ExpenseClaimRevisionStatus";
  v_new_status "ExpenseClaimRevisionStatus";
BEGIN
  IF TG_TABLE_NAME = 'expense_claim_revision_off_site_works' THEN
    IF TG_OP <> 'INSERT' THEN
      v_old_revision_id := OLD."revision_id";
    END IF;
    IF TG_OP <> 'DELETE' THEN
      v_new_revision_id := NEW."revision_id";
    END IF;
  ELSIF TG_TABLE_NAME = 'expense_claim_work_dates' THEN
    IF TG_OP <> 'INSERT' THEN
      v_old_revision_id := OLD."revision_id";
    END IF;
    IF TG_OP <> 'DELETE' THEN
      v_new_revision_id := NEW."revision_id";
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN
      SELECT wd."revision_id"
      INTO v_old_revision_id
      FROM "expense_claim_work_dates" wd
      WHERE wd."id" = OLD."work_date_id";
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT wd."revision_id"
      INTO v_new_revision_id
      FROM "expense_claim_work_dates" wd
      WHERE wd."id" = NEW."work_date_id";
    END IF;
    IF v_old_revision_id IS NULL AND TG_OP = 'DELETE' THEN
      -- The work-date trigger has already verified the owning draft. During a
      -- cascading delete PostgreSQL may hide the parent before deleting codes.
      RETURN OLD;
    END IF;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    SELECT "status" INTO v_old_status
    FROM "expense_claim_revisions"
    WHERE "id" = v_old_revision_id;

    IF v_old_status IS NULL OR v_old_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'submitted or superseded revision snapshots are immutable';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT "status" INTO v_new_status
    FROM "expense_claim_revisions"
    WHERE "id" = v_new_revision_id;

    IF v_new_status IS NULL OR v_new_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'submitted or superseded revision snapshots are immutable';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_require_draft_revision_osw"
BEFORE INSERT OR UPDATE OR DELETE
ON "expense_claim_revision_off_site_works"
FOR EACH ROW
EXECUTE FUNCTION "sraw_require_draft_revision"();

CREATE TRIGGER "trg_require_draft_revision_work_date"
BEFORE INSERT OR UPDATE OR DELETE
ON "expense_claim_work_dates"
FOR EACH ROW
EXECUTE FUNCTION "sraw_require_draft_revision"();

CREATE TRIGGER "trg_require_draft_revision_wesafe"
BEFORE INSERT OR UPDATE OR DELETE
ON "expense_claim_work_date_we_safe_codes"
FOR EACH ROW
EXECUTE FUNCTION "sraw_require_draft_revision"();

-- Drafts may contain incomplete We Safe values, but submission is authoritative.
CREATE OR REPLACE FUNCTION "sraw_validate_revision_submission"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_count INTEGER;
BEGIN
  IF NEW."status" = 'SUBMITTED' AND OLD."status" = 'DRAFT' THEN
    SELECT COUNT(*) INTO v_date_count
    FROM "expense_claim_work_dates"
    WHERE "revision_id" = NEW."id";

    IF v_date_count = 0 OR v_date_count <> NEW."total_days" THEN
      RAISE EXCEPTION 'submitted revision day total does not match work dates';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "expense_claim_work_date_we_safe_codes" code
      JOIN "expense_claim_work_dates" wd ON wd."id" = code."work_date_id"
      WHERE wd."revision_id" = NEW."id"
        AND CHAR_LENGTH(code."code") <> 19
    ) THEN
      RAISE EXCEPTION 'submitted We Safe codes must contain exactly 19 characters';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM "expense_claim_work_dates" wd
      WHERE wd."revision_id" = NEW."id"
        AND wd."requires_we_safe"
        AND NOT EXISTS (
          SELECT 1
          FROM "expense_claim_work_date_we_safe_codes" code
          WHERE code."work_date_id" = wd."id"
        )
    ) THEN
      RAISE EXCEPTION 'every required work date must contain a We Safe code';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_revision_submission"
BEFORE UPDATE OF "status"
ON "expense_claim_revisions"
FOR EACH ROW
EXECUTE FUNCTION "sraw_validate_revision_submission"();

CREATE OR REPLACE FUNCTION "sraw_validate_paper_approval_time"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."paper_approved_at" IS NOT NULL
     AND NEW."paper_approved_at" > clock_timestamp() THEN
    RAISE EXCEPTION 'paper approval time cannot be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_paper_approval_time"
BEFORE INSERT OR UPDATE OF "paper_approved_at"
ON "monthly_request_collections"
FOR EACH ROW
EXECUTE FUNCTION "sraw_validate_paper_approval_time"();

CREATE OR REPLACE FUNCTION "sraw_validate_mrc_replacement"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_draft_status "MonthlyRequestStatus";
  v_source_status "MonthlyRequestStatus";
  v_draft_department TEXT;
  v_source_department TEXT;
  v_draft_month DATE;
  v_source_month DATE;
BEGIN
  SELECT "status", "department_id", "collect_for_month"
  INTO v_draft_status, v_draft_department, v_draft_month
  FROM "monthly_request_collections"
  WHERE "id" = NEW."replacement_draft_id";

  SELECT "status", "department_id", "collect_for_month"
  INTO v_source_status, v_source_department, v_source_month
  FROM "monthly_request_collections"
  WHERE "id" = NEW."voided_mrc_id";

  IF v_draft_status IS NULL OR v_source_status IS NULL THEN
    RAISE EXCEPTION 'replacement or source MRC does not exist';
  END IF;
  IF v_draft_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'replacement MRC must be DRAFT when linked';
  END IF;
  IF v_source_status <> 'VOIDED' THEN
    RAISE EXCEPTION 'replacement source must be VOIDED';
  END IF;
  IF v_draft_department <> v_source_department
     OR v_draft_month <> v_source_month THEN
    RAISE EXCEPTION 'replacement MRC scope differs from voided source';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_mrc_replacement"
BEFORE INSERT OR UPDATE
ON "mrc_replacement_sources"
FOR EACH ROW
EXECUTE FUNCTION "sraw_validate_mrc_replacement"();

-- Review flags are append-only: the only update is OPEN -> RESOLVED.
CREATE OR REPLACE FUNCTION "sraw_protect_claim_review_flag"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'claim review flags are append-only';
  END IF;
  IF OLD."status" <> 'OPEN'
     OR NEW."status" <> 'RESOLVED'
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."expense_claim_id" IS DISTINCT FROM OLD."expense_claim_id"
     OR NEW."note" IS DISTINCT FROM OLD."note"
     OR NEW."opened_by_id" IS DISTINCT FROM OLD."opened_by_id"
     OR NEW."opened_at" IS DISTINCT FROM OLD."opened_at" THEN
    RAISE EXCEPTION 'only resolving an open claim review flag is allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_protect_claim_review_flag"
BEFORE UPDATE OR DELETE
ON "claim_review_flags"
FOR EACH ROW
EXECUTE FUNCTION "sraw_protect_claim_review_flag"();
