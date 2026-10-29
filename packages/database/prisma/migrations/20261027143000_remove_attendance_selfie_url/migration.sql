-- Drop dependent view first
DROP VIEW IF EXISTS "attendance_records_dynamic";

-- AlterTable: drop selfie_url column
ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "selfie_url";

-- Recreate dynamic view over attendance_records
CREATE OR REPLACE VIEW "attendance_records_dynamic" AS
SELECT 
  ar.*,
  (ar.clock_in_time AT TIME ZONE 'UTC' AT TIME ZONE current_setting('TIMEZONE')) AS clock_in_local,
  (ar.clock_out_time AT TIME ZONE 'UTC' AT TIME ZONE current_setting('TIMEZONE')) AS clock_out_local
FROM "attendance_records" ar;
