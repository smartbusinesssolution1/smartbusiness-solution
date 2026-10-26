// What the amount and date fields show while someone types, kept in the check's own format
// (1,250.50 and 10/22/2026) so the form reads exactly like the preview and the printed check.
// Pure functions: the components in components/app/check-inputs.tsx wire them to inputs.

// An amount as typed: digits and one point, at most 2 decimals, never above `max`, grouped
// with commas. null means "refuse this keystroke" (the field keeps its previous value).
export function formatAmountTyping(raw: string, max: number): string | null {
  const clean = raw.replace(/[^\d.]/g, "");
  if (clean === "") return "";
  if ((clean.match(/\./g) ?? []).length > 1) return null;
  const [intRaw = "", dec] = clean.split(".");
  if (dec !== undefined && dec.length > 2) return null;
  const int = intRaw.replace(/^0+(?=\d)/, "");
  if (Number(`${int || "0"}.${dec || "0"}`) > max) return null;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === undefined ? grouped : `${grouped || "0"}.${dec}`;
}

// A finished amount, as on the check: "1250.5" → "1,250.50". Empty for anything else.
export function formatAmount(value: string | number): string {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO.exec(value);
  if (!m) return false;
  // A real calendar day: 02/30 parses as March 2nd, so compare the parts back.
  const d = new Date(`${value}T00:00:00Z`);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3]);
}

// A date as typed, shown as MM/DD/YYYY with the slashes added for you. Returns what to show,
// and the ISO date once all 8 digits make a real day (else null).
export function formatDateTyping(raw: string): { text: string; iso: string | null } {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  const text = parts.join("/");
  if (digits.length < 8) return { text, iso: null };
  const iso = `${digits.slice(4, 8)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
  return { text, iso: isIsoDate(iso) ? iso : null };
}

export function isoToUs(iso: string): string {
  const m = ISO.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

// Where the caret goes after reformatting. Counted from the END: an edit at the caret leaves
// the text after it alone, while the start may change (leading zeros, a "0" before the point).
// `kept` matches the characters the formatting keeps (digits, and the point for amounts).
export function caretFromEnd(formatted: string, rawAfterCaret: string, kept: RegExp): number {
  const tail = rawAfterCaret.split("").filter((c) => kept.test(c)).length;
  if (tail === 0) return formatted.length;
  let seen = 0;
  for (let i = formatted.length - 1; i >= 0; i--) {
    if (kept.test(formatted[i]!)) seen++;
    if (seen === tail) return i;
  }
  return 0;
}
