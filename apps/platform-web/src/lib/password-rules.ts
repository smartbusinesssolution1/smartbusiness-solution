// The password rules platform-api enforces at sign-up (apps/platform-api/src/modules/auth/
// auth.schema.ts, passwordSchema). Shown live under the field so a person sees what is
// missing before submitting; the server stays the authority and checks again.
export const PASSWORD_RULES: ReadonlyArray<{ label: string; test: (password: string) => boolean }> = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'A number', test: (p) => /[0-9]/.test(p) },
  { label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordMeetsRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
