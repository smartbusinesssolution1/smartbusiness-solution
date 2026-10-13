-- AlterTable: Add created_by_id to approval_workflow_rules
--
-- WHY: Approval rules are security configuration. Knowing WHO created
-- each rule directly on the row (not just in the audit log) enables
-- the settings page to show "Created by Maria Garcia" without
-- querying the audit log.
--
-- The column is NOT NULL. For existing rows (if any), we need a default.
-- Since this table is typically empty in development, we use a
-- two-step approach: add as nullable, backfill, then set NOT NULL.

-- Step 1: Add nullable column
ALTER TABLE "approval_workflow_rules" ADD COLUMN "created_by_id" TEXT;

-- Step 2: Backfill existing rows (if any) with the first user in the workspace
UPDATE "approval_workflow_rules" awr
SET "created_by_id" = (
  SELECT wm."user_id"
  FROM "workspace_members" wm
  WHERE wm."workspace_id" = awr."workspace_id"
  AND wm."deleted_at" IS NULL
  LIMIT 1
)
WHERE "created_by_id" IS NULL;

-- Step 3: Set NOT NULL constraint
ALTER TABLE "approval_workflow_rules" ALTER COLUMN "created_by_id" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "approval_workflow_rules"
ADD CONSTRAINT "approval_workflow_rules_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
