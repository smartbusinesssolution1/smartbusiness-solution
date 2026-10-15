-- AlterTable
ALTER TABLE "attendance_records" ALTER COLUMN "clockOutDate" DROP NOT NULL,
ALTER COLUMN "clock_out_time" DROP NOT NULL,
ALTER COLUMN "clock_out_latitude" DROP NOT NULL,
ALTER COLUMN "clock_out_longitude" DROP NOT NULL,
ALTER COLUMN "check_out_face_match_confidence" DROP NOT NULL,
ADD COLUMN "working_hours" DECIMAL(4,2),
ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_records_clockInDate_idx" ON "attendance_records"("clockInDate");
