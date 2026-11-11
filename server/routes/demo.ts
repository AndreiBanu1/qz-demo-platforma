import { Hono } from 'hono';
import { now } from '../domain/time';
import type { Env, Vars } from '../env';
import { AppError } from '../errors';
import { resetDatabase } from '../seed/reset';

/** Token-protected demo routes. Later tasks add fixtures here. */
export const demo = new Hono<{ Bindings: Env; Variables: Vars }>();

demo.get('/health', (c) => c.json({ ok: true }));

demo.post('/reset', async (c) => {
  const token = c.req.header('X-Demo-Reset-Token');
  if (!token || !c.env.DEMO_RESET_TOKEN || token !== c.env.DEMO_RESET_TOKEN) {
    throw new AppError(404, 'NOT_FOUND');
  }
  await resetDatabase(c.env.DB, now(c.env));
  return c.body(null, 204);
});
