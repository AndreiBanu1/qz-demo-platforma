import { env } from 'cloudflare:test';
import { expect, test } from 'vitest';
import { createApp } from '../../server/app';
import { ERROR_COPY } from '../../server/errors';

const ORIGIN = 'https://demo.test';
const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: '{}' });

function expectHeaders(res: Response) {
  expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
}

test('an unexpected error is a generic 500 with an id and the headers', async () => {
  const app = createApp();
  app.get('/boom', () => {
    throw new Error('secret database detail');
  });
  const res = await app.request(`${ORIGIN}/boom`, {}, env);
  expect(res.status).toBe(500);
  const body = (await res.json()) as { error: { code: string; message: string; id: string } };
  expect(body.error.id).toMatch(/^[0-9a-f]{8}$/);
  expect(body).toEqual({
    error: { code: 'INTERNAL', message: `A apărut o eroare. Cod: ${body.error.id}`, id: body.error.id },
  });
  expect(JSON.stringify(body)).not.toContain('secret');
  expectHeaders(res);
});

test('a live Stripe key makes the Worker refuse to serve', async () => {
  const res = await createApp().request(`${ORIGIN}/__demo/health`, {}, { ...env, STRIPE_SECRET_KEY: 'sk_live_abc' });
  expect(res.status).toBe(500);
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INTERNAL');
  expectHeaders(res);
});

test('the Stripe webhook path is exempt from the Origin check', async () => {
  const res = await createApp().request(post('/api/payments/stripe/webhook'), {}, env);
  expect(res.status).not.toBe(403);
});

test('Origin: null on a POST is refused', async () => {
  const res = await createApp().request(post('/api/anything', { Origin: 'null' }), {}, env);
  expect(res.status).toBe(403);
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
});

test('a POST with the same Origin passes the check', async () => {
  const res = await createApp().request(post('/api/anything', { Origin: ORIGIN }), {}, env);
  expect(res.status).toBe(404);
});

test('reset fails closed when the secret is unset', async () => {
  const res = await createApp().request(post('/__demo/reset', { 'X-Demo-Reset-Token': '' }), {}, { ...env, DEMO_RESET_TOKEN: '' });
  expect(res.status).toBe(404);
});

test('ERROR_COPY matches the brief verbatim', () => {
  expect(ERROR_COPY).toEqual({
    VALIDATION: 'Datele trimise nu sunt valide.',
    UNAUTHENTICATED: 'Intră în cont ca să continui.',
    FORBIDDEN: 'Nu ai acces la această pagină.',
    NOT_FOUND: 'Nu am găsit ce cauți.',
    SLOT_TAKEN: 'Ora aleasă tocmai a fost rezervată. Alege altă oră.',
    HOLD_EXPIRED: 'Rezervarea a expirat. Alege din nou ora.',
    CANCEL_TOO_LATE: 'Programarea poate fi anulată cu cel puțin 24 de ore înainte.',
    INVALID_CREDENTIALS: 'Email sau parolă greșite',
    EMAIL_NOT_RESERVED: 'Folosește o adresă inventată, de exemplu ana@exemplu.test',
    EMAIL_TAKEN: 'Există deja un cont cu această adresă.',
    CARD_DECLINED: 'Cardul a fost refuzat. Încearcă alt card de test.',
    NOT_TEST_CARD: 'Folosește un card de test',
    TOO_MANY_ATTEMPTS: 'Prea multe încercări. Încearcă din nou în 15 minute.',
    INTERNAL: 'A apărut o eroare. Cod: {id}',
  });
});
