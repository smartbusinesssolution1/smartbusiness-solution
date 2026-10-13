-- CreateEnum
CREATE TYPE "PaperSize" AS ENUM ('LETTER', 'A4');

-- Calibration profiles become workspace-owned printer profiles.
-- "user_id" used to mean "owner"; it now records who performed the calibration.
-- Renamed (not dropped) so existing profiles keep that history.
ALTER TABLE "calibration_profiles" RENAME COLUMN "user_id" TO "calibrated_by_id";
ALTER TABLE "calibration_profiles" RENAME CONSTRAINT "calibration_profiles_user_id_fkey" TO "calibration_profiles_calibrated_by_id_fkey";

ALTER TABLE "calibration_profiles"
    ADD COLUMN "paper_size" "PaperSize" NOT NULL DEFAULT 'LETTER',
    ADD COLUMN "tray" VARCHAR(50),
    ADD COLUMN "scale_x" DECIMAL(6,4),
    ADD COLUMN "scale_y" DECIMAL(6,4),
    ADD COLUMN "measurements_json" JSONB,
    ADD COLUMN "ref_version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "calibrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Every profile created before this migration was measured on an A4 calibration sheet
-- with the v1 method (one line per axis, vertical measured from the bottom edge).
UPDATE "calibration_profiles" SET "paper_size" = 'A4', "calibrated_at" = "updated_at";

-- AlterTable: print snapshot on each check
ALTER TABLE "checks"
    ADD COLUMN "calibration_profile_id" TEXT,
    ADD COLUMN "print_offset_x_pts" DECIMAL(6,2),
    ADD COLUMN "print_offset_y_pts" DECIMAL(6,2),
    ADD COLUMN "print_paper_size" "PaperSize";

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_calibration_profile_id_fkey" FOREIGN KEY ("calibration_profile_id") REFERENCES "calibration_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
