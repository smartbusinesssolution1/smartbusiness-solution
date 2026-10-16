-- CreateIndex
CREATE INDEX "attendance_records_employee_id_clockInDate_idx" ON "attendance_records"("employee_id", "clockInDate");

-- CreateIndex
CREATE INDEX "attendance_records_clockInDate_status_idx" ON "attendance_records"("clockInDate", "status");

-- CreateIndex
CREATE INDEX "attendance_records_clockInDate_clock_in_time_idx" ON "attendance_records"("clockInDate" DESC, "clock_in_time" DESC);

-- CreateIndex
CREATE INDEX "employees_workspace_id_is_active_deleted_at_idx" ON "employees"("workspace_id", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "product_subscriptions_tenant_id_status_idx" ON "product_subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_user_id_deleted_at_idx" ON "tenant_members"("tenant_id", "user_id", "deleted_at");
