-- Attachments live in encrypted file storage: rename the column to what it holds (a
-- storage key, not a URL; RENAME keeps any data) and add the SHA-256 checked on
-- every download. The table is empty at this point, so sha256 can be required.
ALTER TABLE "check_attachments" RENAME COLUMN "storage_url" TO "storage_key";
ALTER TABLE "check_attachments" ADD COLUMN "sha256" CHAR(64) NOT NULL;
CREATE INDEX "check_attachments_storage_key_idx" ON "check_attachments"("storage_key");
