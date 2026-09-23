CREATE TABLE "user_presence" (
    "user_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_presence_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "user_presence_last_seen_at_idx" ON "user_presence"("last_seen_at");

ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
