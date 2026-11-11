import type { Context } from 'hono';
import type { Env, SessionUser, Vars } from '../env';
import { AppError } from '../errors';

type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

/** The signed-in user, or 401 UNAUTHENTICATED. */
export function requireUser(c: Ctx): SessionUser {
  const user = c.var.user;
  if (!user) throw new AppError(401, 'UNAUTHENTICATED');
  return user;
}

/** The signed-in admin: 401 without a session, 403 for a client. */
export function requireAdmin(c: Ctx): SessionUser {
  const user = requireUser(c);
  if (user.role !== 'admin') throw new AppError(403, 'FORBIDDEN');
  return user;
}
