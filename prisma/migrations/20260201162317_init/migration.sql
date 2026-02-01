-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'SESSION_REFRESH', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_STATUS_CHANGED', 'PROFILE_VIEWED', 'PROFILE_UPDATED', 'PASSWORD_CHANGED', 'DEPARTMENT_CREATED', 'DEPARTMENT_UPDATED', 'DEPARTMENT_DELETED', 'SYSTEM_ACCESS', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "keycloak_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pea_email" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "position" TEXT,
    "position_short" TEXT,
    "position_level" TEXT,
    "department_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "description" TEXT,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_action_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "action_description" TEXT,
    "target_user_id" TEXT,
    "target_department_id" TEXT,
    "target_entity_type" TEXT,
    "target_entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_path" TEXT,
    "request_method" TEXT,
    "metadata" JSONB,
    "previous_data" JSONB,
    "new_data" JSONB,
    "is_success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloak_id_key" ON "users"("keycloak_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_keycloak_id_idx" ON "users"("keycloak_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_short_name_key" ON "departments"("short_name");

-- CreateIndex
CREATE INDEX "departments_name_idx" ON "departments"("name");

-- CreateIndex
CREATE INDEX "departments_short_name_idx" ON "departments"("short_name");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "user_action_logs_user_id_idx" ON "user_action_logs"("user_id");

-- CreateIndex
CREATE INDEX "user_action_logs_action_type_idx" ON "user_action_logs"("action_type");

-- CreateIndex
CREATE INDEX "user_action_logs_target_user_id_idx" ON "user_action_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "user_action_logs_target_department_id_idx" ON "user_action_logs"("target_department_id");

-- CreateIndex
CREATE INDEX "user_action_logs_created_at_idx" ON "user_action_logs"("created_at");

-- CreateIndex
CREATE INDEX "user_action_logs_is_success_idx" ON "user_action_logs"("is_success");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_action_logs" ADD CONSTRAINT "user_action_logs_target_department_id_fkey" FOREIGN KEY ("target_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
