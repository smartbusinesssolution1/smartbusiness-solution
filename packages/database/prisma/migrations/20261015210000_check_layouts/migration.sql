-- Check layouts: each printer profile says where the check sits on the paper in its
-- tray; each printed check records the layout (and slot) it was printed with.
-- Existing profiles keep today's behaviour (CHECK_MIDDLE).

-- CreateEnum
CREATE TYPE "CheckLayout" AS ENUM ('CHECK_TOP', 'CHECK_MIDDLE', 'CHECK_BOTTOM', 'THREE_PER_PAGE');

-- AlterTable
ALTER TABLE "calibration_profiles" ADD COLUMN     "layout" "CheckLayout" NOT NULL DEFAULT 'CHECK_MIDDLE';

-- AlterTable
ALTER TABLE "checks" ADD COLUMN     "print_layout" "CheckLayout",
ADD COLUMN     "print_position" INTEGER;


-- Backfill: every check printed so far was printed in the middle layout.
UPDATE "checks" SET "print_layout" = 'CHECK_MIDDLE' WHERE "print_paper_size" IS NOT NULL AND "print_layout" IS NULL;
