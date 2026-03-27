-- CreateEnum
CREATE TYPE "MrcApprovalStage" AS ENUM ('HPA_CHECK', 'RK_CHECK', 'OK_APPROVE');

-- CreateEnum
CREATE TYPE "MrcStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ClaimDocumentStatus" ADD VALUE 'COLLECTED';

-- CreateTable
CREATE TABLE "mrc_approval_steps" (
    "id" TEXT NOT NULL,
    "monthly_request_collection_id" TEXT NOT NULL,
    "stage" "MrcApprovalStage" NOT NULL,
    "status" "MrcStepStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "mrc_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mrc_approval_steps_monthly_request_collection_id_idx" ON "mrc_approval_steps"("monthly_request_collection_id");

-- CreateIndex
CREATE INDEX "mrc_approval_steps_stage_idx" ON "mrc_approval_steps"("stage");

-- CreateIndex
CREATE INDEX "mrc_approval_steps_status_idx" ON "mrc_approval_steps"("status");

-- CreateIndex
CREATE INDEX "mrc_approval_steps_reviewer_id_idx" ON "mrc_approval_steps"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "mrc_approval_steps_monthly_request_collection_id_stage_key" ON "mrc_approval_steps"("monthly_request_collection_id", "stage");

-- AddForeignKey
ALTER TABLE "mrc_approval_steps" ADD CONSTRAINT "mrc_approval_steps_monthly_request_collection_id_fkey" FOREIGN KEY ("monthly_request_collection_id") REFERENCES "monthly_request_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrc_approval_steps" ADD CONSTRAINT "mrc_approval_steps_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
