/*
  Warnings:

  - You are about to drop the column `email` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `plan_status` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_subscription_id` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_ends_at` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `trial_ends_at` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `tenant_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `approval_enabled` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the column `max_check_amount` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the column `max_future_days` on the `workspaces` table. All the data in the column will be lost.
  - You are about to drop the column `max_past_days` on the `workspaces` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[billing_email]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billing_email` to the `tenants` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_fkey";

-- DropIndex
DROP INDEX "tenants_email_key";

-- DropIndex
DROP INDEX "tenants_stripe_subscription_id_key";

-- DropIndex
DROP INDEX "users_tenant_id_idx";

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "product_slug" VARCHAR(50);

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "email",
DROP COLUMN "plan",
DROP COLUMN "plan_status",
DROP COLUMN "stripe_subscription_id",
DROP COLUMN "subscription_ends_at",
DROP COLUMN "trial_ends_at",
ADD COLUMN     "billing_email" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "tenant_id";

-- AlterTable
ALTER TABLE "workspaces" DROP COLUMN "approval_enabled",
DROP COLUMN "max_check_amount",
DROP COLUMN "max_future_days",
DROP COLUMN "max_past_days";

-- DropEnum
DROP TYPE "PlanStatus";

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invited_by_id" TEXT,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_ends_at" TIMESTAMP(3),
    "stripe_subscription_id" TEXT,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "check_printing_settings" (
    "workspace_id" TEXT NOT NULL,
    "approval_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_check_amount" DECIMAL(12,2) NOT NULL DEFAULT 999999.99,
    "max_past_days" INTEGER NOT NULL DEFAULT 30,
    "max_future_days" INTEGER NOT NULL DEFAULT 90,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_printing_settings_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "workspace_member_roles" (
    "id" TEXT NOT NULL,
    "workspace_member_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_member_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_idx" ON "tenant_members"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_members_user_id_idx" ON "tenant_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_user_id_key" ON "tenant_members"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_subscriptions_stripe_subscription_id_key" ON "product_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "product_subscriptions_tenant_id_idx" ON "product_subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_subscriptions_tenant_id_product_id_key" ON "product_subscriptions"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_product_id_slug_key" ON "roles"("product_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_product_id_action_key" ON "permissions"("product_id", "action");

-- CreateIndex
CREATE INDEX "workspace_member_roles_role_id_idx" ON "workspace_member_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_member_roles_workspace_member_id_role_id_key" ON "workspace_member_roles"("workspace_member_id", "role_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_product_slug_idx" ON "audit_log"("tenant_id", "product_slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_billing_email_key" ON "tenants"("billing_email");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_printing_settings" ADD CONSTRAINT "check_printing_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member_roles" ADD CONSTRAINT "workspace_member_roles_workspace_member_id_fkey" FOREIGN KEY ("workspace_member_id") REFERENCES "workspace_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member_roles" ADD CONSTRAINT "workspace_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member_roles" ADD CONSTRAINT "workspace_member_roles_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
