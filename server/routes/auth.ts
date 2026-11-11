import { Hono } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { isReservedEmail } from '../auth/email';
import { hashPassword, iterationsFor, verifyPassword } from '../auth/password';
import { countFailures, recordFailure } from '../db/attempts';
import { createSession, deleteSession } from '../db/sessions';
import { getUserByEmail, insertUser } from '../db/users';
import { now } from '../domain/time';
import type { Env, SessionUser, Vars } from '../env';
import { AppError } from '../errors';
import { SESSION_COOKIE } from '../middleware/session';
import { parseBody } from '../validate';
import { loginSchema, signupSchema } from '../../shared/schemas';

const SESSION_DAYS = 7;
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;

/** A well-formed hash that matches nothing, verified when the email is unknown so both paths cost the same. */
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';
const DUMMY_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export const auth = new Hono<{ Bindings: Env; Variables: Vars }>();

auth.post('/auth/signup', async (c) => {
  const body = await parseBody(c, signupSchema);
  if (!isReservedEmail(body.email)) throw new AppError(400, 'EMAIL_NOT_RESERVED');
  const at = now(c.env);
  const id = crypto.randomUUID();
  const created = await insertUser(c.env.DB, {
    id,
    email: body.email,
    name: body.name,
    role: 'client',
    password_hash: await hashPassword(body.password, iterationsFor(c.env)),
    created_at: at.toISOString(),
  });
  if (!created) throw new AppError(409, 'EMAIL_TAKEN');
  const user: SessionUser = { id, email: body.email, name: body.name, role: 'client' };
  return c.json({ user }, 201);
});

auth.post('/auth/login', async (c) => {
  const body = await parseBody(c, loginSchema);
  const ip = c.req.header('CF-Connecting-IP') ?? '0.0.0.0';
  const at = now(c.env);
  const since = new Date(at.getTime() - WINDOW_MS);

  const [byEmail, byIp] = await Promise.all([
    countFailures(c.env.DB, { email: body.email }, since),
    countFailures(c.env.DB, { ip }, since),
  ]);
  if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS');
  }

  const row = await getUserByEmail(c.env.DB, body.email);
  const dummy = `pbkdf2-sha256$${iterationsFor(c.env)}$${DUMMY_SALT}$${DUMMY_KEY}`;
  const ok = await verifyPassword(body.password, row?.password_hash ?? dummy);
  if (!row || !ok) {
    await recordFailure(c.env.DB, body.email, ip, at);
    throw new AppError(401, 'INVALID_CREDENTIALS');
  }

  const expires = new Date(at.getTime() + SESSION_DAYS * 86_400_000);
  const sessionId = await createSession(c.env.DB, row.id, expires);
  await setSignedCookie(c, SESSION_COOKIE, sessionId, c.env.COOKIE_SECRET, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
  const user: SessionUser = { id: row.id, email: row.email, name: row.name, role: row.role };
  return c.json({ user });
});

auth.post('/auth/logout', async (c) => {
  const id = await getSignedCookie(c, c.env.COOKIE_SECRET, SESSION_COOKIE);
  if (id) await deleteSession(c.env.DB, id);
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
  return c.body(null, 204);
});

auth.get('/me', (c) => {
  const user = c.get('user');
  if (!user) throw new AppError(401, 'UNAUTHENTICATED');
  return c.json({ user });
});
