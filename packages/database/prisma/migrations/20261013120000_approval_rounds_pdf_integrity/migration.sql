-- Approval rounds: every resubmit starts a new round, and each approver may
-- vote once per round. Existing votes all belong to round 1.
ALTER TABLE "checks" ADD COLUMN "approval_round" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "approval_records" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "approval_records" ALTER COLUMN "round" DROP DEFAULT;

CREATE UNIQUE INDEX "approval_records_check_id_round_approver_id_key"
  ON "approval_records"("check_id", "round", "approver_id");

-- PDF integrity: SHA-256 of the stored check PDF, verified on download.
ALTER TABLE "checks" ADD COLUMN "pdf_sha256" CHAR(64);
