import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTrialEnd, PRODUCT_CATALOG, productUrl } from './products';

const checkPrinting = PRODUCT_CATALOG.find((p) => p.slug === 'check-printing')!;
const clockIn = PRODUCT_CATALOG.find((p) => p.slug === 'clock-in-clock-out')!;

describe('productUrl', () => {
  it('uses the configured subdomain and opens the product\'s entry page', () => {
    assert.equal(
      productUrl(checkPrinting, { VITE_CHECK_PRINTING_URL: 'https://checks.example.com/' }),
      'https://checks.example.com/workspaces',
    );
    assert.equal(productUrl(clockIn, { VITE_CLOCK_IN_URL: 'https://clock.example.com' }), 'https://clock.example.com/');
  });

  it('in development, falls back to the fixed local ports', () => {
    assert.equal(productUrl(checkPrinting, { DEV: true }), 'http://localhost:5173/workspaces');
    assert.equal(productUrl(clockIn, { DEV: true }), 'http://localhost:5174/');
  });

  it('names the company it is opened for, so a person in several companies lands in the right one', () => {
    assert.equal(
      productUrl(checkPrinting, { VITE_CHECK_PRINTING_URL: 'https://checks.example.com' }, 'c0ffee00-0000-4000-8000-000000000001'),
      'https://checks.example.com/workspaces?tenant=c0ffee00-0000-4000-8000-000000000001',
    );
  });

  it('a production build without the address gives no link, never localhost', () => {
    assert.equal(productUrl(checkPrinting, { DEV: false }), null);
    assert.equal(productUrl(checkPrinting, { DEV: false, VITE_CHECK_PRINTING_URL: '   ' }), null);
  });

  it('the catalog slugs match platform-api\'s product slugs', () => {
    assert.deepEqual(PRODUCT_CATALOG.map((p) => p.slug), ['check-printing', 'clock-in-clock-out']);
  });
});

describe('formatTrialEnd', () => {
  it('formats an ISO date and ignores missing or broken ones', () => {
    assert.match(formatTrialEnd('2026-11-11T07:01:53.000Z')!, /2026/);
    assert.equal(formatTrialEnd(null), null);
    assert.equal(formatTrialEnd('not a date'), null);
  });
});
