-- CreateTable
CREATE TABLE "OffSiteWork" (
    "id" TEXT NOT NULL,
    "inner_ref_document_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "objective" TEXT,
    "location" TEXT,
    "employee_list" JSONB,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "original_file_id" TEXT,

    CONSTRAINT "OffSiteWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Files" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER,
    "file_content" BYTEA,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Files_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OffSiteWork" ADD CONSTRAINT "OffSiteWork_original_file_id_fkey" FOREIGN KEY ("original_file_id") REFERENCES "Files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
