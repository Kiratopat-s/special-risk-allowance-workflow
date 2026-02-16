-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signature_data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signatures_user_id_idx" ON "signatures"("user_id");

-- CreateIndex
CREATE INDEX "signatures_deleted_at_idx" ON "signatures"("deleted_at");

-- CreateIndex
CREATE INDEX "signatures_user_id_deleted_at_idx" ON "signatures"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
