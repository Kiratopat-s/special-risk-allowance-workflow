/*
  Warnings:

  - You are about to drop the `Files` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Files" DROP CONSTRAINT "Files_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "off_site_works" DROP CONSTRAINT "off_site_works_original_file_id_fkey";

-- AlterTable
ALTER TABLE "expense_claims" ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "collected_at" TIMESTAMP(3),
ADD COLUMN     "count_dates" DECIMAL(65,30),
ADD COLUMN     "monthly_request_collection_id" TEXT;

-- DropTable
DROP TABLE "Files";

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER,
    "file_content" BYTEA,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_request_collections" (
    "id" TEXT NOT NULL,
    "collector_id" TEXT NOT NULL,
    "collect_for_month" TIMESTAMP(3) NOT NULL,
    "count_dates" DECIMAL(65,30),
    "amount" DECIMAL(65,30),
    "status" "ClaimDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "monthly_request_collections_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_monthly_request_collection_id_fkey" FOREIGN KEY ("monthly_request_collection_id") REFERENCES "monthly_request_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_request_collections" ADD CONSTRAINT "monthly_request_collections_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
