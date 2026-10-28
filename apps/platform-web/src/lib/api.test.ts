import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from './api';
import { fetchSession } from './auth';

// A scripted fetch: each call takes the next answer and records what was asked.
type Answer = { status: number; body: unknown } | 'network-down';
function scriptFetch(answers: Answer[]) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body as string | undefined });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected request to ${url}`);
    if (next === 'network-down') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return calls;
}

const ok = (data: unknown) => ({ status: 200, body: { success: true, data } });
const fail = (status: number, code: string, message: string, details?: Record<string, string[]>) => ({
  status,
  body: { success: false, error: { code, message, details } },
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('api client', () => {
  it('calls the portal\'s own /api/v1 path (the proxy forwards it) and returns data', async () => {
    const calls = scriptFetch([ok({ user: { id: 'u1' } })]);

    const data = await api<{ user: { id: string } }>('/auth/me');

    assert.equal(data.user.id, 'u1');
    assert.equal(calls[0]!.url, '/api/v1/auth/me');
  });

  it('on an expired access cookie (401): refreshes once, then retries the same request', async () => {
    const calls = scriptFetch([fail(401, 'TOKEN_EXPIRED', 'Token expired.'), ok({}), ok({ user: { id: 'u1' } })]);

    await api('/auth/me');

    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.url}`),
      ['GET /api/v1/auth/me', 'POST /api/v1/auth/refresh', 'GET /api/v1/auth/me'],
    );
  });

  it('when the refresh also fails: the 401 reaches the caller, no endless retrying', async () => {
    const calls = scriptFetch([fail(401, 'TOKEN_EXPIRED', 'Token expired.'), fail(401, 'UNAUTHORIZED', 'No session.')]);

    await assert.rejects(api('/auth/me'), (err: ApiError) => err.status === 401);
    assert.equal(calls.length, 2);
  });

  it('a wrong password (401 from login) is never treated as an expired session', async () => {
    const calls = scriptFetch([fail(401, 'UNAUTHORIZED', 'Invalid email or password.')]);

    await assert.rejects(api('/auth/login', { method: 'POST', body: {} }), (err: ApiError) => err.message === 'Invalid email or password.');
    assert.equal(calls.length, 1);
  });

  it('keeps the server\'s message and per-field errors for the form', async () => {
    scriptFetch([fail(400, 'VALIDATION_ERROR', 'Validation Failed', { password: ['Password must contain at least one number'] })]);

    await assert.rejects(api('/auth/register', { method: 'POST', body: {} }), (err: ApiError) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.equal(err.field('password'), 'Password must contain at least one number');
      assert.equal(err.field('email'), undefined);
      return true;
    });
  });

  it('sends the body as JSON', async () => {
    const calls = scriptFetch([ok({})]);

    await api('/auth/login', { method: 'POST', body: { email: 'a@b.test', password: 'x' } });

    assert.deepEqual(JSON.parse(calls[0]!.body!), { email: 'a@b.test', password: 'x' });
  });

  it('a server that can\'t be reached becomes a readable error, not a crash', async () => {
    scriptFetch(['network-down']);

    await assert.rejects(api('/auth/me'), (err: ApiError) => err.code === 'NETWORK_ERROR' && err.status === 0);
  });
});

describe('fetchSession', () => {
  it('nobody signed in (401 after the refresh attempt) is null, not an error', async () => {
    scriptFetch([fail(401, 'UNAUTHORIZED', 'Authentication required.'), fail(401, 'UNAUTHORIZED', 'No refresh token.')]);

    assert.equal(await fetchSession(), null);
  });

  it('any other failure is still an error (a server outage must not look like "signed out")', async () => {
    scriptFetch([fail(500, 'INTERNAL_ERROR', 'Something went wrong.')]);

    await assert.rejects(fetchSession(), (err: ApiError) => err.status === 500);
  });
});
