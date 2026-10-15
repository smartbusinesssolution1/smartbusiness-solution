-- The signature is a key into encrypted file storage, not a URL: rename the column
-- (RENAME keeps any data; a generated drop-and-add would destroy it) and record who
-- changed the signature and when.
ALTER TABLE "bank_accounts" RENAME COLUMN "signature_image_url" TO "signature_storage_key";

ALTER TABLE "bank_accounts" ADD COLUMN "signature_updated_at" TIMESTAMP(3),
ADD COLUMN "signature_updated_by_id" TEXT;

ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_signature_updated_by_id_fkey" FOREIGN KEY ("signature_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
