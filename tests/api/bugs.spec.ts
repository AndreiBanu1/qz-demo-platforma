import { withBugs } from '../support/bugs';
import { isLocalTarget } from '../support/hosts';
import { expect, test, type Client } from '../support/fixtures';

const password = 'parola-de-test-1';
const DAY = '2027-01-11'; // a Monday no other spec touches; local time is UTC+2 in January
const VOPSIT_COMPLET = 'vopsit-complet'; // 120 min
const LUCIAN = 'stylist-lucian';
const ip = () => ({
  'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`,
});
const unique = () => `user-${crypto.randomUUID()}@exemplu.test`;
const book = (c: { post: Client['request']['post'] }, start: string, serviceId = 'tuns-dama', stylistId = LUCIAN) =>
  c.post('/api/bookings', { data: { serviceId, stylistId, start } });

test('GET /__demo/bugs lists no active bugs for a clean session, with the labels', async ({ request }) => {
  const body = await (await request.get('/__demo/bugs')).json();
  expect(body.active).toEqual([]);
  expect(body.labels['slow-login']).toBe('login lent');
});

test('POST /__demo/bugs sets the cookie, answers the active ids, and off clears it', async ({ request, baseURL }) => {
  const on = await withBugs(request, ['idor-booking', 'slow-login']);
  const active = await (await on.get('/__demo/bugs')).json();
  expect(active.active).toEqual(['slow-login', 'idor-booking']); // canonical order
  const off = await on.post('/__demo/bugs', { data: { ids: 'off' }, headers: { Origin: new URL(baseURL!).origin } });
  expect(await off.json()).toEqual({ active: [] });
  expect(off.headers()['set-cookie']).toMatch(/qz_bugs=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  await on.dispose();
});

test('POST /__demo/bugs with a bad body is VALIDATION', async ({ request }) => {
  const r = await request.post('/__demo/bugs', { data: { nope: 1 } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error.code).toBe('VALIDATION');
});

test('a cross-origin POST /__demo/bugs is refused with 403', async ({ request }) => {
  const r = await request.post('/__demo/bugs', { data: { ids: 'all' }, headers: { Origin: 'https://evil.test' } });
  expect(r.status()).toBe(403);
  const none = await request.post('/__demo/bugs', { data: { ids: 'all' }, headers: { Origin: '' } });
  expect(none.status()).toBe(403);
});

test('login-enumeration on: unknown email and wrong password get different messages', async ({ request, newClient }) => {
  const c = await newClient();
  const ctx = await withBugs(request, ['login-enumeration']);
  const unknown = await ctx.post('/api/auth/login', { data: { email: unique(), password }, headers: ip() });
  expect(unknown.status()).toBe(401);
  expect((await unknown.json()).error.message).toBe('Nu există niciun cont cu acest email');
  const wrong = await ctx.post('/api/auth/login', { data: { email: c.email, password: 'gresita-total' }, headers: ip() });
  expect(wrong.status()).toBe(401);
  expect((await wrong.json()).error.message).toBe('Parola este greșită');
  await ctx.dispose();
});

test('login-enumeration off: both failures say the same generic thing', async ({ request, newClient }) => {
  const c = await newClient();
  const a = await request.post('/api/auth/login', { data: { email: unique(), password }, headers: ip() });
  const b = await request.post('/api/auth/login', { data: { email: c.email, password: 'gresita-total' }, headers: ip() });
  expect((await a.json()).error.message).toBe('Email sau parolă greșite');
  expect((await b.json()).error.message).toBe('Email sau parolă greșite');
});

test('slow-login on: login takes at least 3000 ms, on success and on failure', async ({ request, newClient, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'local only');
  const c = await newClient();
  const ctx = await withBugs(request, ['slow-login']);
  for (const pw of [c.password, 'gresita-total']) {
    const t0 = Date.now();
    const r = await ctx.post('/api/auth/login', { data: { email: c.email, password: pw }, headers: ip() });
    expect(r.status()).toBe(pw === c.password ? 200 : 401);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2950);
  }
  await ctx.dispose();
});

test('slow-login off: login answers well under 3 s', async ({ request, newClient }) => {
  const c = await newClient();
  const t0 = Date.now();
  await request.post('/api/auth/login', { data: { email: c.email, password: c.password }, headers: ip() });
  expect(Date.now() - t0).toBeLessThan(3000);
});

test('booking-past-closing on: 18:45 is offered for Vopsit complet and booking it succeeds', async ({ request, newClient }) => {
  const c = await newClient();
  const start = `${DAY}T16:45:00.000Z`; // 18:45 local
  const clean = await (await request.get(`/api/slots?serviceId=${VOPSIT_COMPLET}&date=${DAY}&stylistId=${LUCIAN}`)).json();
  expect(clean.slots.map((s: { start: string }) => s.start)).not.toContain(start);
  expect((await book(c.request, start, VOPSIT_COMPLET)).status()).toBe(400);

  const ctx = await withBugs(request, ['booking-past-closing']);
  const buggy = await (await ctx.get(`/api/slots?serviceId=${VOPSIT_COMPLET}&date=${DAY}&stylistId=${LUCIAN}`)).json();
  expect(buggy.slots.map((s: { start: string }) => s.start)).toContain(start);
  const mine = await withBugs(c, ['booking-past-closing']);
  const r = await book(mine, start, VOPSIT_COMPLET);
  expect(r.status()).toBe(201);
  await ctx.dispose();
  await mine.dispose();
});

test('leaky-errors on: a malformed start → 500 with the SQL and a stack; off → 400 VALIDATION', async ({ newClient }) => {
  const c = await newClient();
  const bad = '2026-13-45T99:00';
  const clean = await book(c.request, bad);
  expect(clean.status()).toBe(400);
  expect((await clean.json()).error.code).toBe('VALIDATION');

  const mine = await withBugs(c, ['leaky-errors']);
  const r = await book(mine, bad);
  expect(r.status()).toBe(500);
  const text = await r.text();
  expect(text).toContain('SELECT');
  expect(text).toContain('at ');
  const body = JSON.parse(text);
  expect(Object.keys(body).sort()).toEqual(['error', 'sql', 'stack']);
  // a well-formed start is unaffected by the bug
  const ok = await book(mine, `${DAY}T07:00:00.000Z`);
  expect(ok.status()).toBe(201);
  await mine.dispose();
});

test("idor-booking on: another client's booking is returned; off: 404", async ({ newClient }) => {
  const owner = await newClient();
  const other = await newClient();
  const created = await (await book(owner.request, `${DAY}T08:00:00.000Z`)).json();
  expect((await other.request.get(`/api/bookings/${created.id}`)).status()).toBe(404);

  const mine = await withBugs(other, ['idor-booking']);
  const r = await mine.get(`/api/bookings/${created.id}`);
  expect(r.status()).toBe(200);
  expect((await r.json()).id).toBe(created.id);
  // cancel stays owner-only
  expect((await mine.post(`/api/bookings/${created.id}/cancel`)).status()).toBe(404);
  await mine.dispose();
});

test('cool-down still applies with every bug on', async ({ request, newClient, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'local only');
  test.setTimeout(60_000); // five failed logins at 3 s each
  const c = await newClient();
  const ctx = await withBugs(request, 'all');
  const headers = ip();
  for (let i = 0; i < 5; i++) {
    expect((await ctx.post('/api/auth/login', { data: { email: c.email, password: 'gresita-total' }, headers })).status()).toBe(401);
  }
  const blocked = await ctx.post('/api/auth/login', { data: { email: c.email, password: c.password }, headers });
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).error.code).toBe('TOO_MANY_ATTEMPTS');
  await ctx.dispose();
});
