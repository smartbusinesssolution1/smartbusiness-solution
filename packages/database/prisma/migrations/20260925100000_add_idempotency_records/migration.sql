-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (for finding existing keys for a user)
CREATE UNIQUE INDEX "idempotency_records_key_user_id_key" ON "idempotency_records"("key", "user_id");

-- CreateIndex (for cleanup job to delete expired records)
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
