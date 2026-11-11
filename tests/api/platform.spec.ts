import { expect, test } from '@playwright/test';
import { RESET_TOKEN } from '../support/reset-token';

const HEADERS = {
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

function expectSecurityHeaders(h: Record<string, string>) {
  for (const [k, v] of Object.entries(HEADERS)) expect(h[k]).toBe(v);
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['strict-transport-security']).toContain('max-age=');
}

test('every API response is noindex and has the security headers', async ({ request }) => {
  const r = await request.get('/__demo/health');
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ ok: true });
  expectSecurityHeaders(r.headers());
});

test('error responses carry the headers too', async ({ request }) => {
  const r = await request.get('/api/nope');
  expect(r.status()).toBe(404);
  expectSecurityHeaders(r.headers());
});

test('static files carry the same headers', async ({ request }) => {
  for (const path of ['/', '/robots.txt']) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
    expectSecurityHeaders(r.headers());
  }
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Allow: /');
});

test('unknown API route returns the standard 404 shape', async ({ request }) => {
  const r = await request.get('/api/nope');
  expect(await r.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Nu am găsit ce cauți.' } });
});

test('POST with a foreign Origin is refused with 403', async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: 'https://evil.test' } });
  const r = await ctx.post('/api/anything', { data: {} });
  expect(r.status()).toBe(403);
  expect((await r.json()).error.code).toBe('FORBIDDEN');
  await ctx.dispose();
});

test('POST without an Origin is refused with 403', async ({ baseURL }) => {
  // Plain fetch: Playwright request contexts inherit the config's Origin header.
  const r = await fetch(new URL('/api/anything', baseURL), { method: 'POST', body: '{}' });
  expect(r.status).toBe(403);
});

test('POST with the matching Origin reaches routing (404, not 403)', async ({ request }) => {
  const r = await request.post('/api/anything', { data: {} });
  expect(r.status()).toBe(404);
});

test('reset with a wrong or missing token is 404', async ({ request }) => {
  const wrong = await request.post('/__demo/reset', { headers: { 'X-Demo-Reset-Token': 'nope' } });
  expect(wrong.status()).toBe(404);
  expect((await wrong.json()).error.code).toBe('NOT_FOUND');
  expect((await request.post('/__demo/reset')).status()).toBe(404);
});

test('reset with the right token is 204, even without an Origin', async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({ baseURL });
  const r = await ctx.post('/__demo/reset', { headers: { 'X-Demo-Reset-Token': RESET_TOKEN } });
  expect(r.status()).toBe(204);
  await ctx.dispose();
});
