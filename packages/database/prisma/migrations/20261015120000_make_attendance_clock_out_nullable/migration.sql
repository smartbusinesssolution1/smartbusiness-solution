-- AlterTable
ALTER TABLE "attendance_records" ALTER COLUMN "clockOutDate" DROP NOT NULL,
ALTER COLUMN "clock_out_time" DROP NOT NULL,
ALTER COLUMN "clock_out_latitude" DROP NOT NULL,
ALTER COLUMN "clock_out_longitude" DROP NOT NULL,
ALTER COLUMN "check_out_face_match_confidence" DROP NOT NULL;

ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "working_hours" DECIMAL(4,2);
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_records_clockInDate_idx" ON "attendance_records"("clockInDate");

