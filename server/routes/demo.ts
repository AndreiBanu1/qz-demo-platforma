import { Hono, type Context } from 'hono';
import { deleteCookie, setSignedCookie } from 'hono/cookie';
import { BUG_LABELS, BUGS_COOKIE, parseBugs } from '../bugs/registry';
import { z } from 'zod';
import { now } from '../domain/time';
import type { Env, Vars } from '../env';
import { setHoldUntil } from '../db/bookings';
import { deleteUserByEmail } from '../db/users';
import { AppError } from '../errors';
import { resetDatabase } from '../seed/reset';
import { parseBody } from '../validate';

/** Compares SHA-256 digests in constant time, so neither length nor content leaks. */
async function tokensMatch(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  // timingSafeEqual is a Workers extension missing from the DOM SubtleCrypto type.
  return (crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean }).timingSafeEqual(da, db);
}

/**
 * Demo routes. Token-protected: POST /reset and POST /fixtures/* (the fixtures also need DEMO_FIXTURES=true). Open: GET /health, GET and POST /bugs
 * (the SPA calls /bugs without a token, so it keeps the Origin check).
 */
export const demo = new Hono<{ Bindings: Env; Variables: Vars }>();

demo.get('/health', (c) => c.json({ ok: true }));

async function requireToken(c: Context<{ Bindings: Env; Variables: Vars }>): Promise<void> {
  const token = c.req.header('X-Demo-Reset-Token');
  if (!token || !c.env.DEMO_RESET_TOKEN || !(await tokensMatch(token, c.env.DEMO_RESET_TOKEN))) {
    throw new AppError(404, 'NOT_FOUND');
  }
}

demo.post('/reset', async (c) => {
  await requireToken(c);
  await resetDatabase(c.env.DB, now(c.env));
  return c.body(null, 204);
});

/** The fixtures only exist where DEMO_FIXTURES is `true` (local test runs). Anywhere else they are a plain 404. */
demo.use('/fixtures/*', async (c, next) => {
  if (c.env.DEMO_FIXTURES !== 'true') throw new AppError(404, 'NOT_FOUND');
  await next();
});

/** Removes one user and leaves their sessions in place, so a test can prove a dangling session gets 401. */
demo.post('/fixtures/delete-user', async (c) => {
  await requireToken(c);
  const { email } = await parseBody(c, z.object({ email: z.string().min(1) }));
  await deleteUserByEmail(c.env.DB, email.trim().toLowerCase());
  return c.body(null, 204);
});

/** Test-only: ends a booking's hold one second before the current clock, so a test can pay too late. */
demo.post('/fixtures/expire-hold/:bookingId', async (c) => {
  await requireToken(c);
  const at = new Date(now(c.env).getTime() - 1000);
  if (!(await setHoldUntil(c.env.DB, c.req.param('bookingId'), at))) throw new AppError(404, 'NOT_FOUND');
  return c.body(null, 204);
});

demo.get('/bugs', (c) => c.json({ active: [...c.get('bugs')], labels: BUG_LABELS }));

/** Turns bugs on for this browser session only. `off` clears the cookie; BUGS_ENABLED=false ignores the request. */
demo.post('/bugs', async (c) => {
  const { ids } = await parseBody(c, z.object({ ids: z.string().max(500) }));
  if (c.env.BUGS_ENABLED === 'false') return c.json({ active: [] });
  const active = parseBugs(ids);
  if (active.length === 0) {
    deleteCookie(c, BUGS_COOKIE, { path: '/', secure: true });
  } else {
    // A session cookie: no Max-Age, so it ends with the browser session.
    await setSignedCookie(c, BUGS_COOKIE, active.join(','), c.env.COOKIE_SECRET, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
    });
  }
  return c.json({ active });
});
