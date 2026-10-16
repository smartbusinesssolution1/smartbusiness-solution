import "dotenv/config";
import { createDecipheriv } from "crypto";
import { prisma } from "../src/index.js";
import { bankAccountFingerprint } from "../src/bank-fingerprint.js";
import { decideDatabaseTarget } from "./seed-guard.js";

// ═══════════════════════════════════════════════════════════════
// BACKFILL BANK ACCOUNT FINGERPRINTS (R-08)
//
// Accounts created before fingerprints existed have none. This computes them (it must
// decrypt the numbers, which a SQL migration cannot do) and REPORTS the same real account
// recorded twice in one company, without changing those records: which one to keep, and
// what happened to the check numbers issued from both, is a human decision.
//
// Safe to run again: only rows without a fingerprint are touched.
// Exit code: 0 done, 2 done but duplicates need attention, 1 refused or failed.
//
//   pnpm backfill:bank-fingerprints                         (local database)
//   BACKFILL_CONFIRM=<db host> pnpm backfill:bank-fingerprints   (any other database)
// ═══════════════════════════════════════════════════════════════

// Mirrors EncryptionService (check-printing-backend): "ivHex:ciphertextHex:authTagHex", AES-256-GCM.
function decrypt(encrypted: string, keyHex: string): string {
  const [ivHex, ciphertext, tagHex] = encrypted.split(":");
  if (!ivHex || !ciphertext || !tagHex) throw new Error("Invalid encrypted data format");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(ciphertext, "hex", "utf8") + decipher.final("utf8");
}

interface Row {
  id: string;
  tenantId: string;
  workspaceName: string;
  bankName: string;
  last4: string;
  state: string;
  nextCheckNumber: number;
  fingerprint: string | null; // already stored
}

function describe(row: Row): string {
  return `${row.id}  ${row.bankName} ****${row.last4}  workspace "${row.workspaceName}"  ${row.state}  next check #${row.nextCheckNumber}`;
}

async function main(): Promise<number> {
  const decision = decideDatabaseTarget(process.env.DATABASE_URL, process.env.NODE_ENV, process.env.BACKFILL_CONFIRM, {
    action: "add bank account fingerprints to",
    confirmVariable: "BACKFILL_CONFIRM",
    command: "pnpm backfill:bank-fingerprints",
    allowProduction: true,
  });
  if (!decision.allowed) {
    console.error(`\n❌ ${decision.message}\n`);
    return 1;
  }
  const key = process.env.ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    console.error("\n❌ ENCRYPTION_KEY must be the same 64-hex-character key the API uses.\n");
    return 1;
  }
  console.log(`Backfilling bank account fingerprints in "${decision.target.database}" on ${decision.target.host}\n`);

  const accounts = await prisma.bankAccount.findMany({
    include: { workspace: { select: { tenantId: true, businessName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const toRow = (a: (typeof accounts)[number]): Row => ({
    id: a.id,
    tenantId: a.workspace.tenantId,
    workspaceName: a.workspace.businessName,
    bankName: a.bankName,
    last4: a.accountNumberLast4,
    state: a.deletedAt ? "deleted" : a.isActive ? "active" : "inactive",
    nextCheckNumber: a.nextCheckNumber,
    fingerprint: a.accountFingerprint,
  });

  // Fingerprint every account (stored, or computed now), grouped by company + fingerprint.
  const groups = new Map<string, { row: Row; computed: string | null }[]>();
  const unreadable: Row[] = [];
  for (const account of accounts) {
    const row = toRow(account);
    let fingerprint = row.fingerprint;
    let computed: string | null = null;
    if (!fingerprint) {
      try {
        computed = bankAccountFingerprint(
          key,
          decrypt(account.routingNumberEncrypted, key),
          decrypt(account.accountNumberEncrypted, key),
        );
        fingerprint = computed;
      } catch {
        unreadable.push(row);
        continue;
      }
    }
    const groupKey = `${row.tenantId}:${fingerprint}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), { row, computed }]);
  }

  let filled = 0;
  const duplicateGroups: Row[][] = [];
  for (const members of groups.values()) {
    if (members.length > 1) {
      duplicateGroups.push(members.map((m) => m.row));
      continue; // left as they are: a person decides
    }
    const only = members[0]!;
    if (only.computed) {
      await prisma.bankAccount.update({ where: { id: only.row.id }, data: { accountFingerprint: only.computed } });
      filled += 1;
    }
  }

  console.log(`Filled ${filled} fingerprint(s).`);
  if (unreadable.length > 0) {
    console.log(`\n⚠️  ${unreadable.length} account(s) could not be decrypted with this ENCRYPTION_KEY (skipped):`);
    unreadable.forEach((r) => console.log(`   ${describe(r)}`));
  }
  if (duplicateGroups.length > 0) {
    console.log(`\n⚠️  ${duplicateGroups.length} real account(s) are recorded more than once in the same company.`);
    console.log("   Their records were NOT changed. Keep one (restore or reactivate it), remove the others, and check");
    console.log("   whether the same check number was issued from more than one record:");
    duplicateGroups.forEach((group, i) => {
      console.log(`   Account ${i + 1}:`);
      group.forEach((r) => console.log(`     ${describe(r)}`));
    });
    return 2;
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("\n❌ Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
