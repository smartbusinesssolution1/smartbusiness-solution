-- AlterTable
ALTER TABLE "employees" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "employees_deleted_at_idx" ON "employees"("deleted_at");
