-- Create RegularizationStatus Enum
DO $$ BEGIN
    CREATE TYPE "RegularizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create RegularizationReason Enum
DO $$ BEGIN
    CREATE TYPE "RegularizationReason" AS ENUM (
        'MISSED_CLOCK_IN',
        'MISSED_CLOCK_OUT',
        'MISSED_BOTH',
        'ON_DUTY_CLIENT_VISIT',
        'WORK_FROM_HOME',
        'TECHNICAL_ISSUE',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add Regularization Settings to attendance_settings
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "enable_regularization" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "max_regularization_past_days" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "monthly_regularization_limit" INTEGER NOT NULL DEFAULT 5;

-- Add is_regularized flag to attendance_records
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "is_regularized" BOOLEAN NOT NULL DEFAULT false;

-- Create attendance_regularizations Table
CREATE TABLE IF NOT EXISTS "attendance_regularizations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "attendance_record_id" TEXT,
    "date" DATE NOT NULL,
    "reason_category" "RegularizationReason" NOT NULL,
    "reason_text" TEXT NOT NULL,
    "requested_clock_in_time" TIMESTAMP(3),
    "requested_clock_out_time" TIMESTAMP(3),
    "status" "RegularizationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "attendance_regularizations_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
DO $$ BEGIN
    ALTER TABLE "attendance_regularizations"
        ADD CONSTRAINT "attendance_regularizations_workspace_id_fkey"
        FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_regularizations"
        ADD CONSTRAINT "attendance_regularizations_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_regularizations"
        ADD CONSTRAINT "attendance_regularizations_attendance_record_id_fkey"
        FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_regularizations"
        ADD CONSTRAINT "attendance_regularizations_reviewer_id_fkey"
        FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "attendance_regularizations_workspace_id_idx" ON "attendance_regularizations"("workspace_id");
CREATE INDEX IF NOT EXISTS "attendance_regularizations_employee_id_idx" ON "attendance_regularizations"("employee_id");
CREATE INDEX IF NOT EXISTS "attendance_regularizations_workspace_id_status_idx" ON "attendance_regularizations"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "attendance_regularizations_employee_id_date_idx" ON "attendance_regularizations"("employee_id", "date");
