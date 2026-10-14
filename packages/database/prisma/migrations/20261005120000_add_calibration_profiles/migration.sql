-- calibration_profiles was already created by 20260913051431_init_complete_schema.
-- This migration originally repeated that CREATE TABLE, which failed on any fresh
-- database. It is now idempotent: a no-op where the table exists, and a correct
-- create where it does not.

-- CreateTable
CREATE TABLE IF NOT EXISTS "calibration_profiles" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "profile_name" TEXT NOT NULL,
    "horizontal_offset_pts" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "vertical_offset_pts" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calibration_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calibration_profiles_workspace_id_idx" ON "calibration_profiles"("workspace_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calibration_profiles_workspace_id_fkey') THEN
    ALTER TABLE "calibration_profiles" ADD CONSTRAINT "calibration_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calibration_profiles_user_id_fkey') THEN
    ALTER TABLE "calibration_profiles" ADD CONSTRAINT "calibration_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
