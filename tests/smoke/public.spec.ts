import { expect, test } from '@playwright/test';
import { DEMO_ACCOUNTS } from '../../shared/demo-accounts';

/**
 * Read-mostly checks for the deployed copy (npm run test:smoke). One successful login and a few GETs: nothing
 * here may brute-force, load or reset the public site (spec 9). The local suite skips this file, since the local
 * Worker runs on a fixed clock (DEMO_NOW) and real dates are in its past.
 */

const client = DEMO_ACCOUNTS.find((a) => a.role === 'client')!;

/** Calendar date in Bucharest, `days` from today, as YYYY-MM-DD. */
function bucharestDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(d);
}

test('health answers ok', async ({ request }) => {
  const r = await request.get('/__demo/health');
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ ok: true });
});

test('the home page carries the demo banner and noindex', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await expect(page.getByText('Site demonstrativ realizat de Quality Zone', { exact: true })).toBeVisible();
});

test('the demo client can log in', async ({ request }) => {
  const r = await request.post('/api/auth/login', { data: { email: client.email, password: client.password } });
  expect(r.status()).toBe(200);
  expect((await r.json()).user.email).toBe(client.email);
});

test('the next open day offers at least one slot', async ({ request }) => {
  // Today may be a Sunday or already past closing, so look up to a week ahead.
  for (let days = 0; days <= 7; days++) {
    const r = await request.get(`/api/slots?serviceId=tuns-dama&date=${bucharestDate(days)}`);
    expect(r.status()).toBe(200);
    const { slots } = await r.json();
    if (slots.length > 0) return;
  }
  throw new Error('no open slot in the next 7 days');
});
