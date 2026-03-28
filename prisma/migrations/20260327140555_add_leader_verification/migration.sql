-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClaimDocumentStatus" ADD VALUE 'PENDING_LEADER_VERIFY';
ALTER TYPE "ClaimDocumentStatus" ADD VALUE 'WAIT_FOR_COLLECTION';

-- AlterTable
ALTER TABLE "off_site_works" ADD COLUMN     "leader_email" TEXT,
ADD COLUMN     "leader_emp_id" TEXT,
ADD COLUMN     "leader_first_name" TEXT,
ADD COLUMN     "leader_last_name" TEXT,
ADD COLUMN     "leader_position" TEXT,
ADD COLUMN     "leader_user_id" TEXT;

-- CreateTable
CREATE TABLE "leader_verifications" (
    "id" TEXT NOT NULL,
    "expense_claim_id" TEXT NOT NULL,
    "off_site_work_id" TEXT NOT NULL,
    "leader_user_id" TEXT,
    "leader_email" TEXT,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leader_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leader_verifications_token_key" ON "leader_verifications"("token");

-- CreateIndex
CREATE INDEX "leader_verifications_expense_claim_id_idx" ON "leader_verifications"("expense_claim_id");

-- CreateIndex
CREATE INDEX "leader_verifications_off_site_work_id_idx" ON "leader_verifications"("off_site_work_id");

-- CreateIndex
CREATE INDEX "leader_verifications_leader_user_id_idx" ON "leader_verifications"("leader_user_id");

-- CreateIndex
CREATE INDEX "leader_verifications_token_idx" ON "leader_verifications"("token");

-- CreateIndex
CREATE INDEX "leader_verifications_verified_at_idx" ON "leader_verifications"("verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "leader_verifications_expense_claim_id_off_site_work_id_key" ON "leader_verifications"("expense_claim_id", "off_site_work_id");

-- CreateIndex
CREATE INDEX "off_site_works_leader_user_id_idx" ON "off_site_works"("leader_user_id");

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_off_site_work_id_fkey" FOREIGN KEY ("off_site_work_id") REFERENCES "off_site_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
