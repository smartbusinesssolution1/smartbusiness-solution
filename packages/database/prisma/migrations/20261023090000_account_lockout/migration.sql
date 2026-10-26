-- Account lockout: wrong passwords are counted per account, whichever IP they come from.
ALTER TABLE "users" ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_failed_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);
