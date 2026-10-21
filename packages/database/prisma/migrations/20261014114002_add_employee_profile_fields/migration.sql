-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'employee',
ADD COLUMN     "shift_end_time" TEXT,
ADD COLUMN     "shift_start_time" TEXT,
ADD COLUMN     "shift_type" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "updated_at" TIMESTAMP(3);
