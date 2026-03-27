-- AlterTable
ALTER TABLE "signatures" ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "signatures_user_id_is_active_deleted_at_idx" ON "signatures"("user_id", "is_active", "deleted_at");
