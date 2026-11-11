import { isLocalTarget } from '../support/hosts';
import { RESET_TOKEN } from '../support/reset-token';
import { expect, test } from '../support/fixtures';

const password = 'parola-de-test-1';
const unique = () => `user-${crypto.randomUUID()}@exemplu.test`;
/** Each cool-down test uses its own client IP so failures never leak into other tests. */
const ip = () => ({ 'CF-Connecting-IP': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });

test('sign-up refuses a real-looking email with EMAIL_NOT_RESERVED', async ({ request }) => {
  const r = await request.post('/api/auth/signup', { data: { name: 'Ana', email: 'ana@gmail.com', password } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error.code).toBe('EMAIL_NOT_RESERVED');
});

test('sign-up refuses a password under 10 characters with VALIDATION', async ({ request }) => {
  const r = await request.post('/api/auth/signup', { data: { name: 'Ana', email: unique(), password: '123456789' } });
  expect(r.status()).toBe(400);
  expect((await r.json()).error.code).toBe('VALIDATION');
});

test('a malformed or non-JSON body is VALIDATION, not 500', async ({ request }) => {
  for (const path of ['/api/auth/signup', '/api/auth/login']) {
    const bad = await request.post(path, { data: '{not json', headers: { 'Content-Type': 'application/json' } });
    expect(bad.status(), path).toBe(400);
    expect((await bad.json()).error.code).toBe('VALIDATION');
    const empty = await request.post(path, { data: {} });
    expect(empty.status(), path).toBe(400);
  }
});

test('sign-up creates a client and returns it without secrets', async ({ request }) => {
  const email = unique();
  const r = await request.post('/api/auth/signup', { data: { name: ' Ana ', email: email.toUpperCase(), password } });
  expect(r.status()).toBe(201);
  const { user } = await r.json();
  expect(user).toMatchObject({ email, name: 'Ana', role: 'client' });
  expect(JSON.stringify(user)).not.toContain('hash');
});

test('sign-up treats the same address in another case, or with spaces, as taken', async ({ request }) => {
  const email = unique();
  expect((await request.post('/api/auth/signup', { data: { name: 'A', email, password } })).status()).toBe(201);
  const dup = await request.post('/api/auth/signup', { data: { name: 'B', email: ` ${email.toUpperCase()} `, password } });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).error.code).toBe('EMAIL_TAKEN');
});

test('login sets an HttpOnly, Secure, SameSite=Lax cookie', async ({ request }) => {
  const email = unique();
  await request.post('/api/auth/signup', { data: { name: 'Ana', email, password } });
  const r = await request.post('/api/auth/login', { data: { email, password } });
  expect(r.status()).toBe(200);
  expect((await r.json()).user.email).toBe(email);
  const cookie = r.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')!.value;
  expect(cookie).toContain('qz_session=');
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/Secure/i);
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(cookie).toMatch(/Max-Age=604800/i);
});

test('login with " Ana@Bucla-Verde.TEST " works', async ({ request }) => {
  const r = await request.post('/api/auth/login', { data: { email: ' Ana@Bucla-Verde.TEST ', password: 'Ana-Salon-2026' } });
  expect(r.status()).toBe(200);
  expect((await r.json()).user.email).toBe('ana@bucla-verde.test');
});

test('wrong password and unknown email give the same response', async ({ request }) => {
  const headers = ip();
  const wrong = await request.post('/api/auth/login', { headers, data: { email: 'ana@bucla-verde.test', password: 'gresita-gresita' } });
  const unknown = await request.post('/api/auth/login', { headers, data: { email: unique(), password: 'gresita-gresita' } });
  expect(wrong.status()).toBe(401);
  expect(unknown.status()).toBe(401);
  expect(await wrong.json()).toEqual(await unknown.json());
  expect((await wrong.json()).error.code).toBe('INVALID_CREDENTIALS');
});

test('cool-down: the 6th attempt for one email gets 429, even with the right password', async ({ request, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'local only');
  const email = unique();
  await request.post('/api/auth/signup', { data: { name: 'Ana', email, password } });
  const headers = ip();
  for (let i = 0; i < 5; i++) {
    const r = await request.post('/api/auth/login', { headers, data: { email, password: 'gresita-gresita' } });
    expect(r.status()).toBe(401);
  }
  const blocked = await request.post('/api/auth/login', { headers, data: { email, password } });
  expect(blocked.status()).toBe(429);
  const body = await blocked.json();
  expect(body.error.code).toBe('TOO_MANY_ATTEMPTS');
  expect(body.error.message).toBe('Prea multe încercări. Încearcă din nou în 15 minute.');
});

test('cool-down: one IP is blocked after 30 failures across emails', async ({ request, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'local only');
  const headers = ip();
  for (let i = 0; i < 30; i++) {
    const r = await request.post('/api/auth/login', { headers, data: { email: unique(), password: 'gresita-gresita' } });
    expect(r.status()).toBe(401);
  }
  const blocked = await request.post('/api/auth/login', { headers, data: { email: unique(), password: 'gresita-gresita' } });
  expect(blocked.status()).toBe(429);
});

test('successful logins do not count toward the cool-down', async ({ request }) => {
  const headers = ip();
  for (let i = 0; i < 7; i++) {
    const r = await request.post('/api/auth/login', { headers, data: { email: 'mihai@bucla-verde.test', password: 'Mihai-Salon-2026' } });
    expect(r.status()).toBe(200);
  }
});

test('/api/me is 401 without a session and returns the user with one', async ({ request, newClient }) => {
  const anon = await request.get('/api/me');
  expect(anon.status()).toBe(401);
  expect((await anon.json()).error.code).toBe('UNAUTHENTICATED');
  const client = await newClient();
  const me = await client.request.get('/api/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).user).toMatchObject({ email: client.email, role: 'client' });
});

test('a tampered session cookie is no session', async ({ request }) => {
  const res = await request.get('/api/me', { headers: { Cookie: 'qz_session=not-a-real-session.AAAA' } });
  expect(res.status()).toBe(401);
});

test('the seeded admin has the admin role', async ({ asAdmin }) => {
  const admin = await asAdmin();
  expect((await (await admin.request.get('/api/me')).json()).user.role).toBe('admin');
});

test('session for a user removed by reset returns 401 on /api/me', async ({ request, newClient }) => {
  const client = await newClient();
  expect((await client.request.get('/api/me')).status()).toBe(200);
  const denied = await request.post('/__demo/fixtures/delete-user', { data: { email: client.email } });
  expect(denied.status()).toBe(404);
  const del = await request.post('/__demo/fixtures/delete-user', {
    headers: { 'X-Demo-Reset-Token': RESET_TOKEN },
    data: { email: client.email },
  });
  expect(del.status()).toBe(204);
  const me = await client.request.get('/api/me');
  expect(me.status()).toBe(401);
  expect((await me.json()).error.code).toBe('UNAUTHENTICATED');
});

test('logout ends the session', async ({ newClient }) => {
  const client = await newClient();
  expect((await client.request.get('/api/me')).status()).toBe(200);
  expect((await client.request.post('/api/auth/logout')).status()).toBe(204);
  expect((await client.request.get('/api/me')).status()).toBe(401);
});

test('state-changing auth requests with a foreign Origin are refused', async ({ playwright, baseURL }) => {
  const bare = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: 'https://evil.example' } });
  const r = await bare.post('/api/auth/login', { data: { email: 'ana@bucla-verde.test', password: 'Ana-Salon-2026' } });
  expect(r.status()).toBe(403);
  await bare.dispose();
});
