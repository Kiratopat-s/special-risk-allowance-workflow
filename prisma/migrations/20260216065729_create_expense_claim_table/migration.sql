/*
  Warnings:

  - You are about to drop the `OffSiteWork` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ClaimDocumentStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "OffSiteWork" DROP CONSTRAINT "OffSiteWork_original_file_id_fkey";

-- DropForeignKey
ALTER TABLE "OffSiteWork" DROP CONSTRAINT "OffSiteWork_posted_by_user_id_fkey";

-- DropTable
DROP TABLE "OffSiteWork";

-- CreateTable
CREATE TABLE "off_site_works" (
    "id" TEXT NOT NULL,
    "inner_ref_document_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "objective" TEXT,
    "location" TEXT,
    "employee_list" JSONB,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by_user_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "original_file_id" TEXT,

    CONSTRAINT "off_site_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claims" (
    "id" TEXT NOT NULL,
    "for_month" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "claimant_position" TEXT NOT NULL,
    "selected_dates" JSONB,
    "remark" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ClaimDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "updated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExpenseClaimToOffSiteWork" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExpenseClaimToOffSiteWork_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ExpenseClaimToOffSiteWork_B_index" ON "_ExpenseClaimToOffSiteWork"("B");

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "Files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpenseClaimToOffSiteWork" ADD CONSTRAINT "_ExpenseClaimToOffSiteWork_A_fkey" FOREIGN KEY ("A") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpenseClaimToOffSiteWork" ADD CONSTRAINT "_ExpenseClaimToOffSiteWork_B_fkey" FOREIGN KEY ("B") REFERENCES "off_site_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
