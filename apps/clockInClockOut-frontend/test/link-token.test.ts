import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenFromAddress } from '../src/hooks/useLinkToken';

// Reset links carry the token after "#" (never sent to any server); older emails used
// "?token=", and those links must keep working.
describe('tokenFromAddress', () => {
  it('reads the token after "#" (the form reset emails use now)', () => {
    assert.equal(tokenFromAddress('#token=abc_DEF-123', ''), 'abc_DEF-123');
  });

  it('still reads "?token=" from emails sent before the change', () => {
    assert.equal(tokenFromAddress('', '?token=old-link-token'), 'old-link-token');
  });

  it('prefers "#token=" when both are present', () => {
    assert.equal(tokenFromAddress('#token=from-hash', '?token=from-query'), 'from-hash');
  });

  it('no token in the address: null', () => {
    assert.equal(tokenFromAddress('', ''), null);
    assert.equal(tokenFromAddress('#section', '?tab=1'), null);
  });
});
