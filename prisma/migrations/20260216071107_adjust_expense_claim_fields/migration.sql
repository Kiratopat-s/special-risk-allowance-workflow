/*
  Warnings:

  - You are about to drop the column `claimant_position` on the `expense_claims` table. All the data in the column will be lost.
  - Added the required column `claimant_position_at_submission` to the `expense_claims` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense_claims" DROP COLUMN "claimant_position",
ADD COLUMN     "claimant_position_at_submission" TEXT NOT NULL;
