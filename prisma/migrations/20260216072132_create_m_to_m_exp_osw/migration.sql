-- CreateTable
CREATE TABLE "expense_claim_off_site_work" (
    "expense_claim_id" TEXT NOT NULL,
    "off_site_work_id" TEXT NOT NULL,

    CONSTRAINT "expense_claim_off_site_work_pkey" PRIMARY KEY ("expense_claim_id","off_site_work_id")
);

-- AddForeignKey
ALTER TABLE "expense_claim_off_site_work" ADD CONSTRAINT "expense_claim_off_site_work_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_off_site_work" ADD CONSTRAINT "expense_claim_off_site_work_off_site_work_id_fkey" FOREIGN KEY ("off_site_work_id") REFERENCES "off_site_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
