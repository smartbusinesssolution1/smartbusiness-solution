import { prisma, Prisma } from "@smartbusiness/database";

// ═══════════════════════════════════════════════════════════════
// ATTEMPT LIMITS: WRONG PASSWORDS AND WRONG TWO-FACTOR CODES
//
// Counted per account, whichever IP they come from. Every 5th wrong one in a row locks,
// each time for longer: 1 minute, then 5, 15, then 60. Getting it right (or a password
// reset, for passwords) starts the count again, and so does a day with no attempts, so
// last week's typo doesn't count today.
//
// Passwords and codes keep separate counts (their own columns), with the same rules:
// someone who knows the password still gets only 5 code guesses per lock.
// ═══════════════════════════════════════════════════════════════

export const LOCKOUT = {
  threshold: 5,
  minutes: [1, 5, 15, 60],
  windowHours: 24,
} as const;

// Fixed column names per kind (never from input), inserted with Prisma.raw.
const COLUMNS = {
  password: { count: "failed_login_count", last: "last_failed_login_at", until: "locked_until" },
  code: { count: "mfa_failed_count", last: "mfa_last_failed_at", until: "mfa_locked_until" },
} as const;

export type AttemptKind = keyof typeof COLUMNS;
export type Attempt = { allowed: false } | { allowed: true; count: number; lockedNow: boolean };

// Timestamps are stored as UTC without a time zone, so "now" must be UTC too, whatever
// time zone the database session happens to use.
const NOW_UTC = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

// One attempt, counted BEFORE the password or code is checked, in a single statement:
// add 1 to the count only if not locked, and lock if this was the 5th, 10th… attempt.
// Postgres updates one row at a time, so a burst of 1,000 simultaneous guesses gets 5
// checks, not 1,000.
export async function reserveAttempt(userId: string, kind: AttemptKind): Promise<Attempt> {
  const { threshold, minutes, windowHours } = LOCKOUT;
  const col = COLUMNS[kind];
  const count = Prisma.raw(col.count);
  const last = Prisma.raw(col.last);
  const until = Prisma.raw(col.until);

  // Every expression in SET reads the row as it was, so the new count is spelled out once
  // here and used three times.
  const next = Prisma.sql`CASE
    WHEN ${last} IS NULL OR ${last} < ${NOW_UTC} - make_interval(hours => ${windowHours}::int) THEN 1
    ELSE ${count} + 1 END`;
  const lockMinutes = Prisma.sql`CASE (${next}) / ${threshold}::int
    WHEN 1 THEN ${minutes[0]}::int WHEN 2 THEN ${minutes[1]}::int WHEN 3 THEN ${minutes[2]}::int ELSE ${minutes[3]}::int END`;

  const rows = await prisma.$queryRaw<Array<{ count: number; lockedNow: boolean }>>`
    UPDATE users SET
      ${count} = ${next},
      ${last} = ${NOW_UTC},
      ${until} = CASE WHEN (${next}) % ${threshold}::int = 0
        THEN ${NOW_UTC} + make_interval(mins => ${lockMinutes})
        ELSE ${until} END
    WHERE id = ${userId} AND (${until} IS NULL OR ${until} <= ${NOW_UTC})
    RETURNING ${count} AS count, (${until} IS NOT NULL AND ${until} > ${NOW_UTC}) AS "lockedNow"`;

  const row = rows[0];
  return row ? { allowed: true, count: row.count, lockedNow: row.lockedNow } : { allowed: false };
}

export async function lockedUntil(userId: string, kind: AttemptKind): Promise<Date | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lockedUntil: true, mfaLockedUntil: true } });
  return (kind === "password" ? user?.lockedUntil : user?.mfaLockedUntil) ?? null;
}

// Got it right: the count of wrong ones starts again.
export async function clearAttempts(userId: string, kind: AttemptKind): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data:
      kind === "password"
        ? { failedLoginCount: 0, lastFailedLoginAt: null, lockedUntil: null }
        : { mfaFailedCount: 0, mfaLastFailedAt: null, mfaLockedUntil: null },
  });
}
