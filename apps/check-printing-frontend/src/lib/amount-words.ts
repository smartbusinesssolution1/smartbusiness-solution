// Live preview only: the same wording as the server's amountToWords (check.helpers.ts).
// The server computes and stores the legally binding words when the check is saved; the
// check page always shows that stored value.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function group(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const r = n % 10;
    return TENS[Math.floor(n / 10)]! + (r ? `-${ONES[r]}` : "");
  }
  const r = n % 100;
  return ONES[Math.floor(n / 100)]! + " Hundred" + (r ? ` ${group(r)}` : "");
}

export const MAX_CHECK_AMOUNT = 999_999.99;

export function amountToWords(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_CHECK_AMOUNT) return null;
  const totalCents = Math.round(amount * 100);
  const dollars = Math.floor(totalCents / 100);
  const cents = String(totalCents % 100).padStart(2, "0");
  if (dollars === 0) return `Zero and ${cents}/100`;
  const thousands = Math.floor(dollars / 1000);
  const rest = dollars % 1000;
  let words = "";
  if (thousands > 0) words += `${group(thousands)} Thousand${rest > 0 ? " " : ""}`;
  if (rest > 0) words += group(rest);
  return `${words} and ${cents}/100`;
}
