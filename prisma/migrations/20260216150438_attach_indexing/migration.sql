-- CreateIndex
CREATE INDEX "expense_claim_off_site_work_off_site_work_id_idx" ON "expense_claim_off_site_work"("off_site_work_id");

-- CreateIndex
CREATE INDEX "expense_claims_user_id_idx" ON "expense_claims"("user_id");

-- CreateIndex
CREATE INDEX "expense_claims_created_by_id_idx" ON "expense_claims"("created_by_id");

-- CreateIndex
CREATE INDEX "expense_claims_monthly_request_collection_id_idx" ON "expense_claims"("monthly_request_collection_id");

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
CREATE INDEX "files_uploaded_by_id_idx" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "files_deleted_at_idx" ON "files"("deleted_at");

-- CreateIndex
CREATE INDEX "files_uploaded_at_idx" ON "files"("uploaded_at");

-- CreateIndex
CREATE INDEX "monthly_request_collections_collector_id_idx" ON "monthly_request_collections"("collector_id");

-- CreateIndex
CREATE INDEX "monthly_request_collections_collect_for_month_idx" ON "monthly_request_collections"("collect_for_month");

-- CreateIndex
CREATE INDEX "monthly_request_collections_status_idx" ON "monthly_request_collections"("status");

-- CreateIndex
CREATE INDEX "monthly_request_collections_created_at_idx" ON "monthly_request_collections"("created_at");

-- CreateIndex
CREATE INDEX "monthly_request_collections_collector_id_collect_for_month_idx" ON "monthly_request_collections"("collector_id", "collect_for_month");

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
