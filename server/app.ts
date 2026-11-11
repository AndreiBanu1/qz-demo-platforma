import { Hono } from 'hono';
import { assertNoLiveKeys } from './domain/keys';
import type { Env, Vars } from './env';
import { AppError, ERROR_COPY } from './errors';
import { securityHeaders } from './middleware/headers';
import { bugsMiddleware } from './middleware/bugs';
import { originCheck } from './middleware/origin';
import { sessionMiddleware } from './middleware/session';
import { admin } from './routes/admin';
import { auth } from './routes/auth';
import { bookings } from './routes/bookings';
import { catalog } from './routes/catalog';
import { payments } from './routes/payments';
import { slots } from './routes/slots';
import { demo } from './routes/demo';

export function createApp(): Hono<{ Bindings: Env; Variables: Vars }> {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>();

  // Headers first, so they also land on error and 404 responses.
  app.use('*', securityHeaders);
  app.use('*', async (c, next) => {
    assertNoLiveKeys(c.env as unknown as Record<string, unknown>);
    await next();
  });
  app.use('*', originCheck);

  app.use('*', bugsMiddleware);
  app.use('*', sessionMiddleware);

  app.route('/__demo', demo);
  app.route('/api', auth);
  app.route('/api', catalog);
  app.route('/api', slots);
  app.route('/api', bookings);
  app.route('/api', payments);
  app.route('/api', admin);

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: ERROR_COPY.NOT_FOUND } }, 404));

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: ERROR_COPY[err.code] } },
        err.status as 400 | 401 | 402 | 403 | 404 | 409 | 429 | 500,
      );
    }
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    console.error(`[${id}]`, err);
    return c.json(
      { error: { code: 'INTERNAL', message: ERROR_COPY.INTERNAL.replace('{id}', id), id } },
      500,
    );
  });

  return app;
}
