-- CreateTable
CREATE TABLE "calibration_profiles" (
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
CREATE INDEX "calibration_profiles_workspace_id_idx" ON "calibration_profiles"("workspace_id");

-- AddForeignKey
ALTER TABLE "calibration_profiles" ADD CONSTRAINT "calibration_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_profiles" ADD CONSTRAINT "calibration_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
