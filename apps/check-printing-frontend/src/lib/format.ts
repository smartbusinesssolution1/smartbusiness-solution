// Display helpers. Amounts arrive from the API as strings ("1250.50") so no float ever
// touches money on the way in; they are only turned into numbers to be formatted.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(n) ? usd.format(n) : "—";
}

// Check dates are calendar days stored as UTC midnight: format them in UTC, or a viewer
// west of Greenwich sees the day before.
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dayNumeric = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

export function calendarDay(value: string | null | undefined): string {
  return value ? day.format(new Date(value)) : "—";
}

export function checkFaceDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  return Number.isNaN(d.getTime()) ? "" : dayNumeric.format(d);
}

// Moments (printed at, approved at) in the viewer's own time zone.
const moment = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export function when(value: string | null | undefined): string {
  return value ? moment.format(new Date(value)) : "—";
}

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
export function ago(value: string | null | undefined): string {
  if (!value) return "—";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000], ["month", 2_592_000], ["day", 86_400], ["hour", 3_600], ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function checkNo(n: number | null | undefined, padding = 6): string {
  return n === null || n === undefined ? "—" : String(n).padStart(padding, "0");
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
