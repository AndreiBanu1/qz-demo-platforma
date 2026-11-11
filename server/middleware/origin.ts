import type { MiddlewareHandler } from 'hono';
import { AppError } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Stripe sends no Origin; the webhook is authenticated by its signature. */
const EXEMPT_PATHS = ['/api/payments/stripe/webhook'];

/** Refuses state-changing requests whose Origin is missing or not this Worker's own origin. */
export const originCheck: MiddlewareHandler = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  // /__demo/* is protected by the reset token; scripts and curl call it without an Origin.
  if (SAFE_METHODS.has(c.req.method) || EXEMPT_PATHS.includes(path) || path.startsWith('/__demo/')) {
    return next();
  }
  if (c.req.header('Origin') !== new URL(c.req.url).origin) throw new AppError(403, 'FORBIDDEN');
  return next();
};
