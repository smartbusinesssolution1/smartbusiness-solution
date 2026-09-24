-- Remove legacy boolean permission columns from workspace_members.
-- Permissions are now determined by the RBAC chain:
-- workspace_member_roles → roles → role_permissions → permissions

ALTER TABLE "workspace_members" DROP COLUMN "is_super_user";
ALTER TABLE "workspace_members" DROP COLUMN "can_create";
ALTER TABLE "workspace_members" DROP COLUMN "can_print";
ALTER TABLE "workspace_members" DROP COLUMN "can_approve";
