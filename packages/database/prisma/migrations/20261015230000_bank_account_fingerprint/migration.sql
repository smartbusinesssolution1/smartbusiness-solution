-- Bank account fingerprint (R-08): an HMAC of routing + account number, so the same real
-- account cannot be set up twice. Two records of one account keep separate check counters
-- and give two different checks the same number at the bank.
--
-- Additive: a nullable column and two indexes; no existing row changes. Existing accounts
-- get their fingerprint from the backfill script (it needs ENCRYPTION_KEY to decrypt the
-- numbers, which SQL cannot do). NULLs never collide in a unique index, so old rows do not
-- conflict before they are backfilled.

-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN "account_fingerprint" CHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_workspace_id_account_fingerprint_key" ON "bank_accounts"("workspace_id", "account_fingerprint");

-- CreateIndex
CREATE INDEX "bank_accounts_account_fingerprint_idx" ON "bank_accounts"("account_fingerprint");
