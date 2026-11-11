import { env } from 'cloudflare:test';
import { expect, test } from 'vitest';
import { createApp } from '../../server/app';

const ORIGIN = 'https://demo.test';
const secrets = { COOKIE_SECRET: env.COOKIE_SECRET || 'test-cookie-secret' };

async function setBugs(ids: string, e: object) {
  return createApp().request(
    `${ORIGIN}/__demo/bugs`,
    { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) },
    e,
  );
}
const cookieOf = (res: Response) => res.headers.get('set-cookie')!.split(';')[0];
const active = async (cookie: string, e: object) =>
  ((await (await createApp().request(`${ORIGIN}/__demo/bugs`, { headers: { Cookie: cookie } }, e)).json()) as { active: string[] }).active;

test('the qz_bugs cookie is a session cookie: HttpOnly, Secure, Lax, no Max-Age', async () => {
  const res = await setBugs('slow-login', { ...env, ...secrets });
  expect(res.status).toBe(200);
  const c = res.headers.get('set-cookie')!;
  expect(c).toMatch(/^qz_bugs=/);
  expect(c).toMatch(/HttpOnly/i);
  expect(c).toMatch(/Secure/i);
  expect(c).toMatch(/SameSite=Lax/i);
  expect(c).toMatch(/Path=\//i);
  expect(c).not.toMatch(/Max-Age|Expires/i);
});

test('BUGS_ENABLED=false ignores the cookie and POST answers an empty list', async () => {
  const on = { ...env, ...secrets };
  const cookie = cookieOf(await setBugs('all', on));
  expect(await active(cookie, on)).toHaveLength(6);

  const off = { ...on, BUGS_ENABLED: 'false' };
  expect(await active(cookie, off)).toEqual([]);
  const res = await setBugs('all', off);
  expect(await res.json()).toEqual({ active: [] });
  expect(res.headers.get('set-cookie')).toBeNull();
});

test('a tampered or unsigned qz_bugs cookie is ignored', async () => {
  const on = { ...env, ...secrets };
  expect(await active('qz_bugs=all', on)).toEqual([]);
  const cookie = cookieOf(await setBugs('slow-login', on));
  expect(await active(cookie.replace('slow-login', 'all'), on)).toEqual([]);
});
