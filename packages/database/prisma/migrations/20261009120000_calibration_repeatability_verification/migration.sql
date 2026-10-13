-- CreateEnum
CREATE TYPE "StockType" AS ENUM ('PLAIN_PAPER', 'PERFORATED_STOCK');

-- AlterTable: paper type and sample-check verification on printer profiles
ALTER TABLE "calibration_profiles"
    ADD COLUMN "stock_type" "StockType" NOT NULL DEFAULT 'PLAIN_PAPER',
    ADD COLUMN "verified_at" TIMESTAMP(3),
    ADD COLUMN "verified_by_id" TEXT,
    ADD COLUMN "verification_json" JSONB;

-- AddForeignKey
ALTER TABLE "calibration_profiles" ADD CONSTRAINT "calibration_profiles_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
