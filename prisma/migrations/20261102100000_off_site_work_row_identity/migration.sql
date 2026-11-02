-- Row identity for off_site_works: a surrogate row_id becomes the primary key so the
-- user-supplied document number (id) can be reused by new rows after a soft delete.
-- Live-only uniqueness on id is enforced by a partial unique index below.

ALTER TABLE "off_site_works" ADD COLUMN "row_id" TEXT;
UPDATE "off_site_works" SET "row_id" = gen_random_uuid()::text;
ALTER TABLE "off_site_works" ALTER COLUMN "row_id" SET NOT NULL;

-- Link tables carry the row FK (authoritative) plus the existing document-number
-- snapshot columns, which keep their display/ordering/JSON contracts.
ALTER TABLE "expense_claim_off_site_work" ADD COLUMN "off_site_work_row_id" TEXT;
UPDATE "expense_claim_off_site_work" SET "off_site_work_row_id" = "o"."row_id"
  FROM "off_site_works" "o"
  WHERE "o"."id" = "expense_claim_off_site_work"."off_site_work_id";
ALTER TABLE "expense_claim_off_site_work" ALTER COLUMN "off_site_work_row_id" SET NOT NULL;

ALTER TABLE "leader_verifications" ADD COLUMN "off_site_work_row_id" TEXT;
UPDATE "leader_verifications" SET "off_site_work_row_id" = "o"."row_id"
  FROM "off_site_works" "o"
  WHERE "o"."id" = "leader_verifications"."off_site_work_id";
ALTER TABLE "leader_verifications" ALTER COLUMN "off_site_work_row_id" SET NOT NULL;

-- The old FKs reference off_site_works(id), whose unique/PK constraint is about to be
-- replaced; the new FKs can only be created after row_id is unique.
ALTER TABLE "expense_claim_off_site_work" DROP CONSTRAINT "expense_claim_off_site_work_off_site_work_id_fkey";
ALTER TABLE "leader_verifications" DROP CONSTRAINT "leader_verifications_off_site_work_id_fkey";

ALTER TABLE "off_site_works" DROP CONSTRAINT "off_site_works_pkey";
ALTER TABLE "off_site_works" ADD CONSTRAINT "off_site_works_pkey" PRIMARY KEY ("row_id");

ALTER TABLE "expense_claim_off_site_work" ADD CONSTRAINT "expense_claim_off_site_work_off_site_work_row_id_fkey" FOREIGN KEY ("off_site_work_row_id") REFERENCES "off_site_works"("row_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leader_verifications" ADD CONSTRAINT "leader_verifications_off_site_work_row_id_fkey" FOREIGN KEY ("off_site_work_row_id") REFERENCES "off_site_works"("row_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "expense_claim_off_site_work_off_site_work_row_id_idx" ON "expense_claim_off_site_work"("off_site_work_row_id");
CREATE INDEX "leader_verifications_off_site_work_row_id_idx" ON "leader_verifications"("off_site_work_row_id");
CREATE INDEX "off_site_works_id_idx" ON "off_site_works"("id");
CREATE UNIQUE INDEX "off_site_works_id_live_key" ON "off_site_works"("id") WHERE "deleted_at" IS NULL;
