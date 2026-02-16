/*
  Warnings:

  - You are about to drop the `_ExpenseClaimToOffSiteWork` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ExpenseClaimToOffSiteWork" DROP CONSTRAINT "_ExpenseClaimToOffSiteWork_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExpenseClaimToOffSiteWork" DROP CONSTRAINT "_ExpenseClaimToOffSiteWork_B_fkey";

-- DropTable
DROP TABLE "_ExpenseClaimToOffSiteWork";
