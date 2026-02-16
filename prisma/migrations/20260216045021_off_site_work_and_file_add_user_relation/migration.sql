/*
  Warnings:

  - You are about to drop the column `uploaded_by` on the `Files` table. All the data in the column will be lost.
  - Added the required column `uploaded_by_id` to the `Files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posted_by_user_id` to the `OffSiteWork` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Files" DROP COLUMN "uploaded_by",
ADD COLUMN     "uploaded_by_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OffSiteWork" ADD COLUMN     "posted_by_user_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "OffSiteWork" ADD CONSTRAINT "OffSiteWork_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Files" ADD CONSTRAINT "Files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
