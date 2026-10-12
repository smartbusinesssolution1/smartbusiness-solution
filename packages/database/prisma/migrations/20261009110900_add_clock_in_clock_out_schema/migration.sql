-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'AUTO_CLOSED');

-- CreateEnum
CREATE TYPE "Days" AS ENUM ('SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT');

-- CreateTable
CREATE TABLE "attendance_settings" (
    "workspace_id" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 100,
    "grace_minutes" INTEGER DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "biometric_photo_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL,
    "selfie_url" TEXT,
    "clockInDate" DATE NOT NULL,
    "clock_in_time" TIMESTAMP(3) NOT NULL,
    "clock_in_latitude" DECIMAL(9,6) NOT NULL,
    "clock_in_longitude" DECIMAL(9,6) NOT NULL,
    "clock_in_face_match_confidence" DECIMAL(5,2) NOT NULL,
    "clockOutDate" DATE NOT NULL,
    "clock_out_time" TIMESTAMP(3) NOT NULL,
    "clock_out_latitude" DECIMAL(9,6) NOT NULL,
    "clock_out_longitude" DECIMAL(9,6) NOT NULL,
    "check_out_face_match_confidence" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shiftStartDay" "Days" NOT NULL,
    "shiftStartTime" TIMESTAMP(3) NOT NULL,
    "shiftEndDay" TIMESTAMP(3) NOT NULL,
    "shiftEndTime" "Days" NOT NULL,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_workspace_id_key" ON "employees"("workspace_id");

-- CreateIndex
CREATE INDEX "employees_workspace_id_idx" ON "employees"("workspace_id");

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
