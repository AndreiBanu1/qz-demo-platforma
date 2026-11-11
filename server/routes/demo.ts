import { Hono } from 'hono';
import { now } from '../domain/time';
import type { Env, Vars } from '../env';
import { AppError } from '../errors';
import { resetDatabase } from '../seed/reset';

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

demo.post('/reset', async (c) => {
  const token = c.req.header('X-Demo-Reset-Token');
  if (!token || !c.env.DEMO_RESET_TOKEN || !(await tokensMatch(token, c.env.DEMO_RESET_TOKEN))) {
    throw new AppError(404, 'NOT_FOUND');
  }
  await resetDatabase(c.env.DB, now(c.env));
  return c.body(null, 204);
});
