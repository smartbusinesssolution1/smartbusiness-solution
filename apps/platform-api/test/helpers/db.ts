import { prisma } from "@smartbusiness/database";

/** Empties every application table. Tests call this in beforeEach. */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** The products a new account is subscribed to on sign-up. */
export async function seedProducts(): Promise<void> {
  await prisma.product.create({
    data: { slug: "check-printing", name: "Check Printing", isActive: true },
  });
}

export { prisma };
