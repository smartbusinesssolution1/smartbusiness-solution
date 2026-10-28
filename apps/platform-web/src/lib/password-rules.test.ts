import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PASSWORD_RULES, passwordMeetsRules } from './password-rules';

// The same rules as platform-api's passwordSchema: a password the page accepts must not be
// refused by the server, and the other way round.
describe('password rules', () => {
  it('accepts a password with every required kind of character', () => {
    assert.equal(passwordMeetsRules('Qa-Test#2026'), true);
  });

  for (const [password, missing] of [
    ['Qa-T#26', 'At least 8 characters'],
    ['qa-test#2026', 'An uppercase letter'],
    ['QA-TEST#2026', 'A lowercase letter'],
    ['Qa-Test#abcd', 'A number'],
    ['QaTest2026', 'A special character'],
  ] as const) {
    it(`refuses "${password}": ${missing.toLowerCase()} is missing`, () => {
      assert.equal(passwordMeetsRules(password), false);
      const failing = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
      assert.deepEqual(failing, [missing]);
    });
  }
});
