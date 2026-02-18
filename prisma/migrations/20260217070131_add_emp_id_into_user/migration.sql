-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_id" TEXT;

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");

-- CreateIndex
CREATE INDEX "users_employee_id_idx" ON "users"("employee_id");
