-- Create BreakType Enum
DO $$ BEGIN
    CREATE TYPE "BreakType" AS ENUM ('MEAL', 'REST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create BreakViolationType Enum
DO $$ BEGIN
    CREATE TYPE "BreakViolationType" AS ENUM (
        'NONE',
        'LATE_MEAL',
        'SHORT_MEAL',
        'MISSED_MEAL',
        'SHORT_REST',
        'MISSED_REST'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CompliancePolicy Enum
DO $$ BEGIN
    CREATE TYPE "CompliancePolicy" AS ENUM (
        'FEDERAL_STANDARD',
        'CALIFORNIA_STRICT',
        'CUSTOM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add Break & Labor Compliance Settings to attendance_settings
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "compliance_policy" "CompliancePolicy" NOT NULL DEFAULT 'CALIFORNIA_STRICT';
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "enable_break_tracking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "meal_break_threshold_hours" DECIMAL(3, 1) NOT NULL DEFAULT 5.0;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "min_meal_break_minutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "max_meal_start_shift_hour" DECIMAL(3, 1) NOT NULL DEFAULT 5.0;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "second_meal_threshold_hours" DECIMAL(3, 1) NOT NULL DEFAULT 10.0;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "rest_break_minutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "enforce_break_waivers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "auto_assess_penalties" BOOLEAN NOT NULL DEFAULT true;

-- Add Break & Penalty Aggregates to attendance_records
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "total_break_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "unpaid_break_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "paid_break_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "meal_penalty_hours" DECIMAL(3, 1) NOT NULL DEFAULT 0.0;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "rest_penalty_hours" DECIMAL(3, 1) NOT NULL DEFAULT 0.0;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "meal_waiver_signed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "meal_waiver_reason" TEXT;

-- Create attendance_break_records Table
CREATE TABLE IF NOT EXISTS "attendance_break_records" (
    "id" TEXT NOT NULL,
    "attendance_record_id" TEXT NOT NULL,
    "break_type" "BreakType" NOT NULL DEFAULT 'MEAL',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "start_latitude" DECIMAL(9, 6),
    "start_longitude" DECIMAL(9, 6),
    "end_latitude" DECIMAL(9, 6),
    "end_longitude" DECIMAL(9, 6),
    "is_compliant" BOOLEAN NOT NULL DEFAULT true,
    "violation_type" "BreakViolationType" NOT NULL DEFAULT 'NONE',
    "waiver_signed" BOOLEAN NOT NULL DEFAULT false,
    "waiver_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "attendance_break_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attendance_break_records_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Indexes for attendance_break_records
CREATE INDEX IF NOT EXISTS "attendance_break_records_attendance_record_id_idx" ON "attendance_break_records"("attendance_record_id");
CREATE INDEX IF NOT EXISTS "attendance_break_records_break_type_is_compliant_idx" ON "attendance_break_records"("break_type", "is_compliant");
CREATE INDEX IF NOT EXISTS "attendance_break_records_start_time_idx" ON "attendance_break_records"("start_time" DESC);
