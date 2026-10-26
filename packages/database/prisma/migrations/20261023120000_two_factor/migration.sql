-- Two-factor sign-in (authenticator app codes).
ALTER TABLE "users" ADD COLUMN "mfa_secret_encrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "mfa_pending_secret_encrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "mfa_pending_created_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "mfa_enabled_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "mfa_last_used_step" INTEGER;
ALTER TABLE "users" ADD COLUMN "mfa_failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "mfa_last_failed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "mfa_locked_until" TIMESTAMP(3);

ALTER TABLE "sessions" ADD COLUMN "mfa_verified_at" TIMESTAMP(3);

CREATE TABLE "mfa_backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_backup_codes_user_id_code_hash_key" ON "mfa_backup_codes"("user_id", "code_hash");

ALTER TABLE "mfa_backup_codes" ADD CONSTRAINT "mfa_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
