import { getSignedCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { getSession } from '../db/sessions';
import { getUserById } from '../db/users';
import { now } from '../domain/time';
import type { Env, Vars } from '../env';

export const SESSION_COOKIE = 'qz_session';

/** Sets `c.var.user` on every request: null for no, tampered or expired session, or a user that no longer exists. */
export const sessionMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (c, next) => {
  c.set('user', null);
  const id = await getSignedCookie(c, c.env.COOKIE_SECRET, SESSION_COOKIE);
  if (id) {
    const session = await getSession(c.env.DB, id, now(c.env));
    const row = session ? await getUserById(c.env.DB, session.user_id) : null;
    if (row) c.set('user', { id: row.id, email: row.email, name: row.name, role: row.role });
  }
  await next();
};
