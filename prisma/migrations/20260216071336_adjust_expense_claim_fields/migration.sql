/*
  Warnings:

  - You are about to drop the column `for_month` on the `expense_claims` table. All the data in the column will be lost.
  - Added the required column `expense_month` to the `expense_claims` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense_claims" DROP COLUMN "for_month",
ADD COLUMN     "expense_month" TIMESTAMP(3) NOT NULL;
