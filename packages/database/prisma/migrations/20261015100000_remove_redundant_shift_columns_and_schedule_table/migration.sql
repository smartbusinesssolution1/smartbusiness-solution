-- AlterTable
ALTER TABLE "employees" DROP COLUMN IF EXISTS "shift_start_time";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "shift_end_time";

-- DropForeignKey
ALTER TABLE "schedule" DROP CONSTRAINT IF EXISTS "schedule_employee_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "schedule";

-- DropEnum
DROP TYPE IF EXISTS "Days";
