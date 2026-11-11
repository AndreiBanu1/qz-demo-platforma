import { getSignedCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { BUGS_COOKIE, parseBugs } from '../bugs/registry';
import type { Env, Vars } from '../env';

/** Sets `c.var.bugs` from the signed `qz_bugs` cookie. Empty when disabled, unsigned or tampered with. */
export const bugsMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  let ids: ReturnType<typeof parseBugs> = [];
  if (c.env.BUGS_ENABLED !== 'false') {
    const value = await getSignedCookie(c, c.env.COOKIE_SECRET, BUGS_COOKIE);
    if (value) ids = parseBugs(value);
  }
  c.set('bugs', new Set(ids));
  await next();
};
