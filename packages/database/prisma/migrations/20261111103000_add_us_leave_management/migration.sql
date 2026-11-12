-- CreateEnum
CREATE TYPE "LeaveCategory" AS ENUM ('PTO', 'VACATION', 'SICK', 'BEREAVEMENT', 'JURY_DUTY', 'MILITARY', 'UNPAID', 'FMLA');

-- CreateEnum
CREATE TYPE "LeaveAccrualType" AS ENUM ('FRONTLOAD', 'HOURLY_ACCRUAL', 'PER_PAY_PERIOD', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "leave_policies" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "LeaveCategory" NOT NULL DEFAULT 'PTO',
    "accrual_type" "LeaveAccrualType" NOT NULL DEFAULT 'HOURLY_ACCRUAL',
    "rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "hours_per_year" DECIMAL(6,2) NOT NULL DEFAULT 40.0,
    "max_carryover_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrual_cap_hours" DECIMAL(6,2),
    "waiting_period_days" INTEGER NOT NULL DEFAULT 0,
    "min_notice_days" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "payout_on_termination" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_doc_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_leave_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pending_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carried_over_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "employee_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_hours" DECIMAL(6,2) NOT NULL,
    "is_intermittent" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "attachment_url" TEXT,
    "reviewer_id" TEXT,
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes for leave_policies
CREATE INDEX IF NOT EXISTS "leave_policies_workspace_id_idx" ON "leave_policies"("workspace_id");
CREATE INDEX IF NOT EXISTS "leave_policies_workspace_id_is_active_deleted_at_idx" ON "leave_policies"("workspace_id", "is_active", "deleted_at");

-- Indexes and Unique for employee_leave_balances
CREATE UNIQUE INDEX IF NOT EXISTS "employee_leave_balances_employee_id_policy_id_year_key" ON "employee_leave_balances"("employee_id", "policy_id", "year");
CREATE INDEX IF NOT EXISTS "employee_leave_balances_employee_id_idx" ON "employee_leave_balances"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_leave_balances_policy_id_idx" ON "employee_leave_balances"("policy_id");
CREATE INDEX IF NOT EXISTS "employee_leave_balances_year_idx" ON "employee_leave_balances"("year");

-- Indexes for leave_requests
CREATE INDEX IF NOT EXISTS "leave_requests_workspace_id_idx" ON "leave_requests"("workspace_id");
CREATE INDEX IF NOT EXISTS "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");
CREATE INDEX IF NOT EXISTS "leave_requests_policy_id_idx" ON "leave_requests"("policy_id");
CREATE INDEX IF NOT EXISTS "leave_requests_workspace_id_status_idx" ON "leave_requests"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "leave_requests_employee_id_start_date_idx" ON "leave_requests"("employee_id", "start_date");

-- Foreign Keys
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "leave_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "leave_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
