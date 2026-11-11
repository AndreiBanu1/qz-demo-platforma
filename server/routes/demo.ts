import { Hono, type Context } from 'hono';
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

/** Token-protected demo routes. Later tasks add fixtures here. */
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
