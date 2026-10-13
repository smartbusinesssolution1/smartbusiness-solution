import { ValidationError } from "../errors/index.js";

// ABA routing numbers carry a check digit: with weights 3, 7, 1 repeating,
// the weighted sum of all nine digits must be a multiple of 10.
const ABA_WEIGHTS = [3, 7, 1] as const;

export function isValidAbaRoutingNumber(routingNumber: string): boolean {
  if (!/^\d{9}$/.test(routingNumber)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(routingNumber[i]) * ABA_WEIGHTS[i % 3]!;
  }
  return sum % 10 === 0;
}

// The on-us field holds the account number plus one ⑈ in positions 14–31 (18 slots).
// Letters would print as MICR control symbols, so only digits are accepted.
export function isMicrPrintableAccountNumber(accountNumber: string): boolean {
  return /^\d{4,17}$/.test(accountNumber);
}

// The auxiliary on-us field is limited to 17 characters, including the two ⑈ symbols.
export function isMicrPrintableCheckNumber(checkNumber: string): boolean {
  return /^\d{1,15}$/.test(checkNumber);
}

/**
 * Last line of defence before data reaches the MICR line. Bank accounts are
 * validated on creation, but records created before that validation existed
 * (or edited directly in the database) are caught here.
 */
export function assertMicrPrintable(fields: {
  routingNumber: string;
  accountNumber: string;
  checkNumber: string;
}): void {
  const errors: Record<string, string[]> = {};

  if (!isValidAbaRoutingNumber(fields.routingNumber)) {
    errors.routingNumber = ["The bank account's routing number fails the ABA checksum. Correct the bank account before printing."];
  }
  if (!isMicrPrintableAccountNumber(fields.accountNumber)) {
    errors.accountNumber = ["The bank account's account number must be 4–17 digits to print in the MICR line."];
  }
  if (!isMicrPrintableCheckNumber(fields.checkNumber)) {
    errors.checkNumber = ["The check number must be 1–15 digits to print in the MICR line."];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError("This check cannot be printed: its MICR line would be invalid.", errors);
  }
}
