import { requestFor } from '../support/bugs';
import { expect, test } from '../support/fixtures';

const HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

function expectHeaders(h: Record<string, string>, what: string) {
  for (const [k, v] of Object.entries(HEADERS)) expect(h[k], `${what}: ${k}`).toBe(v);
  const csp = h['content-security-policy'];
  expect(csp, `${what}: csp`).toContain("default-src 'self'");
  expect(csp, `${what}: csp`).toContain("frame-ancestors 'none'");
  expect(csp, `${what}: csp`).not.toContain('unsafe-inline');
  expect(h['strict-transport-security'], `${what}: hsts`).toMatch(/max-age=\d+/);
}

test('the page, a script and the API all carry the security headers', async ({ request }) => {
  const html = await request.get('/');
  expect(html.status()).toBe(200);
  expectHeaders(html.headers(), 'html');

  const script = /<script[^>]+src="([^"]+\.js)"/.exec(await html.text())?.[1];
  expect(script, 'the page loads a script').toBeTruthy();
  const js = await request.get(script!);
  expect(js.status()).toBe(200);
  expect(js.headers()['content-type']).toMatch(/javascript/);
  expectHeaders(js.headers(), 'js');

  const api = await request.get('/api/services');
  expect(api.status()).toBe(200);
  expect(api.headers()['content-type']).toMatch(/application\/json/);
  expectHeaders(api.headers(), 'api');
});

test('the session cookie is HttpOnly, Secure, SameSite=Lax, scoped to / and lasts 7 days', async ({ context }) => {
  const api = await requestFor(context);
  const res = await api.post('/api/auth/login', { data: { email: 'ana@bucla-verde.test', password: 'Ana-Salon-2026' } });
  expect(res.status()).toBe(200);
  const cookie = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')!.value;
  expect(cookie).toMatch(/^qz_session=/);
  for (const flag of [/HttpOnly/i, /Secure/i, /SameSite=Lax/i, /Path=\//i, /Max-Age=604800/i]) expect(cookie).toMatch(flag);
  await api.dispose();
});

test('the bug-mode cookie is HttpOnly, Secure, SameSite=Lax and ends with the browser session', async ({ request }) => {
  const res = await request.post('/__demo/bugs', { data: { ids: 'off' } });
  expect(res.status()).toBe(200);
  const on = await request.post('/__demo/bugs', { data: { ids: 'slow-login' } });
  const cookie = on.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')!.value;
  expect(cookie).toMatch(/^qz_bugs=/);
  for (const flag of [/HttpOnly/i, /Secure/i, /SameSite=Lax/i]) expect(cookie).toMatch(flag);
  expect(cookie).not.toMatch(/Max-Age|Expires/i);
});

test('an error response from the API does not set a cookie', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: { email: 'nu@exemplu.test', password: 'gresita-total-1' } });
  expect(res.status()).toBe(401);
  expect(res.headersArray().some((h) => h.name.toLowerCase() === 'set-cookie')).toBe(false);
});
