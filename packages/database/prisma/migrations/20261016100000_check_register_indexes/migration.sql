-- Check register (F06): indexes for the new filters, sorts and views. Additive only.
--   number and amount ranges, newest-first default sort, outstanding/stale/aging
--   (status = PRINTED ordered by printed_at).

-- CreateIndex
CREATE INDEX "checks_workspace_id_check_number_idx" ON "checks"("workspace_id", "check_number");

-- CreateIndex
CREATE INDEX "checks_workspace_id_amount_idx" ON "checks"("workspace_id", "amount");

-- CreateIndex
CREATE INDEX "checks_workspace_id_created_at_idx" ON "checks"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "checks_workspace_id_status_printed_at_idx" ON "checks"("workspace_id", "status", "printed_at");
