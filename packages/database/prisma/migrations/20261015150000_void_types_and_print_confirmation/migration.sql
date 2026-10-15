-- Void types (cancelled / spoiled / voided after print) and print confirmation.
-- Additive only: new enum and nullable columns; no existing row changes.

-- CreateEnum
CREATE TYPE "VoidType" AS ENUM ('CANCELLED', 'SPOILED', 'VOIDED_AFTER_PRINT');

-- AlterTable
ALTER TABLE "checks" ADD COLUMN     "print_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "print_confirmed_by_id" TEXT,
ADD COLUMN     "void_type" "VoidType";

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_print_confirmed_by_id_fkey" FOREIGN KEY ("print_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: until now a check could only be voided after printing, so every existing
-- void is a void after print.
UPDATE "checks" SET "void_type" = 'VOIDED_AFTER_PRINT' WHERE "status" = 'VOID' AND "void_type" IS NULL;
