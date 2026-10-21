-- AlterTable
ALTER TABLE "attendance_settings" ADD COLUMN     "default_shift_end_time" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "default_shift_start_time" TEXT NOT NULL DEFAULT '09:00';
