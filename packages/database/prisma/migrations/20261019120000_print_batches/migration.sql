-- Batch printing: several checks in one print job (one PDF). Each check still keeps its
-- own one-check PDF; the batch records the shared PDF and where on the paper it started.
-- Printer profiles remember the next blank slot on three-per-page paper.

-- CreateTable
CREATE TABLE "print_batches" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "calibration_profile_id" TEXT,
    "check_count" INTEGER NOT NULL,
    "sheet_count" INTEGER NOT NULL,
    "paper_size" "PaperSize" NOT NULL,
    "layout" "CheckLayout" NOT NULL,
    "start_position" INTEGER,
    "next_position" INTEGER,
    "pdf_storage_url" TEXT NOT NULL,
    "pdf_sha256" CHAR(64) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "checks" ADD COLUMN     "print_batch_id" TEXT;

-- AlterTable
ALTER TABLE "calibration_profiles" ADD COLUMN     "next_slot" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "print_batches_workspace_id_created_at_idx" ON "print_batches"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "checks_print_batch_id_idx" ON "checks"("print_batch_id");

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_print_batch_id_fkey" FOREIGN KEY ("print_batch_id") REFERENCES "print_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_batches" ADD CONSTRAINT "print_batches_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_batches" ADD CONSTRAINT "print_batches_calibration_profile_id_fkey" FOREIGN KEY ("calibration_profile_id") REFERENCES "calibration_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_batches" ADD CONSTRAINT "print_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
