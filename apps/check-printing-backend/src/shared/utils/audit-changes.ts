// ═══════════════════════════════════════════════════════════════
// BEFORE → AFTER FOR THE AUDIT LOG
//
// An entry that says "amount changed" can't answer an auditor's first question: changed
// from what? Edits record the old and new value of each field they actually change:
//
//   { amount: { from: "500.00", to: "5000.00" }, memo: { from: null, to: "Invoice 778" } }
//
// Fields whose value stays the same are left out. Values are stored in a stable, readable
// form: money as "1250.50", calendar days as "2026-10-22", other moments as ISO text.
// ═══════════════════════════════════════════════════════════════

export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

const isCalendarDay = (d: Date) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

function normalise(value: unknown, money: boolean): unknown {
  if (value === undefined || value === null) return null;
  if (money) return Number(value).toFixed(2);
  if (value instanceof Date) return isCalendarDay(value) ? value.toISOString().slice(0, 10) : value.toISOString();
  // A Prisma Decimal that isn't money (none today): its exact text.
  if (typeof value === "object" && typeof (value as { toFixed?: unknown }).toFixed === "function" && "d" in value) {
    return String(value);
  }
  return value;
}

// The fields of `after` (what an edit writes) compared with the same fields of `before`
// (the record as it was). `fields` limits which may be recorded at all: an allow-list, so
// a field added to a form later can never put a secret into the log. `money` names the
// fields to store as "1250.50".
export function auditChanges(
  before: object,
  after: object,
  options: { fields?: readonly string[]; money?: readonly string[] } = {},
): AuditChanges {
  const changes: AuditChanges = {};
  for (const [field, next] of Object.entries(after)) {
    if (next === undefined) continue;
    if (options.fields && !options.fields.includes(field)) continue;
    const isMoney = options.money?.includes(field) ?? false;
    const from = normalise((before as Record<string, unknown>)[field], isMoney);
    const to = normalise(next, isMoney);
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes[field] = { from, to };
  }
  return changes;
}
