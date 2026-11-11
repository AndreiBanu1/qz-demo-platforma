import { Hono } from 'hono';
import { z } from 'zod';
import { extendHoldIfPending, getBooking, type BookingRow } from '../db/bookings';
import { now } from '../domain/time';
import type { Env, SessionUser, Vars } from '../env';
import { AppError } from '../errors';
import { simulatedPay } from '../payments/simulated';
import { createStripeProvider, handleStripeEvent, makeStripeClient, verifyStripeEvent } from '../payments/stripe';
import { parseBody } from '../validate';

const STRIPE_HOLD_MS = 30 * 60_000;

export const payments = new Hono<{ Bindings: Env; Variables: Vars }>();

// Shape-checked and then discarded: only the last 4 digits of the number ever reach the database.
const simulatedPaySchema = z.object({
  cardNumber: z.string().min(1).max(32),
  expiry: z.string().regex(/^\d{2}\s?\/\s?(\d{2}|\d{4})$/),
  cvc: z.string().regex(/^\d{3,4}$/),
});

function stripeEnabled(env: Env): boolean {
  return env.STRIPE_ENABLED !== 'false' && !!env.STRIPE_SECRET_KEY;
}

/** The signed-in user's own booking; anyone else's (or a missing one) is 404. */
async function ownBooking(user: SessionUser | null, id: string, db: D1Database): Promise<BookingRow> {
  if (!user) throw new AppError(401, 'UNAUTHENTICATED');
  const row = await getBooking(db, id);
  if (!row || row.user_id !== user.id) throw new AppError(404, 'NOT_FOUND');
  return row;
}

payments.get('/config', (c) => c.json({ stripeEnabled: stripeEnabled(c.env) }));

payments.post('/payments/:bookingId/simulated', async (c) => {
  const booking = await ownBooking(c.var.user, c.req.param('bookingId'), c.env.DB);
  const body = await parseBody(c, simulatedPaySchema);
  const status = await simulatedPay(c.env.DB, booking, body.cardNumber, now(c.env));
  return c.json({ status });
});

payments.post('/payments/:bookingId/stripe', async (c) => {
  if (!stripeEnabled(c.env)) throw new AppError(404, 'NOT_FOUND');
  const booking = await ownBooking(c.var.user, c.req.param('bookingId'), c.env.DB);
  if (booking.status === 'confirmed') return c.json({ status: 'confirmed' });
  const at = now(c.env);
  // Stripe sessions last at least 30 minutes, so the hold grows to match: a completed session then lands inside it.
  const until = new Date(at.getTime() + STRIPE_HOLD_MS);
  if (!(await extendHoldIfPending(c.env.DB, booking.id, at, until))) {
    const fresh = await getBooking(c.env.DB, booking.id);
    if (fresh?.status === 'confirmed') return c.json({ status: 'confirmed' });
    throw new AppError(409, 'HOLD_EXPIRED');
  }
  const provider = createStripeProvider(makeStripeClient(c.env.STRIPE_SECRET_KEY!), until);
  const { redirectUrl } = await provider.start(booking, new URL(c.req.url).origin);
  return c.json({ url: redirectUrl });
});

// Called by Stripe: no session, no Origin. The signature over the raw body is the only credential.
payments.post('/payments/stripe/webhook', async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new AppError(404, 'NOT_FOUND');
  const signature = c.req.header('Stripe-Signature');
  if (!signature) throw new AppError(400, 'VALIDATION');
  const raw = await c.req.text();
  let event;
  try {
    event = await verifyStripeEvent(raw, signature, secret);
  } catch {
    throw new AppError(400, 'VALIDATION');
  }
  await handleStripeEvent(c.env.DB, event, now(c.env));
  return c.json({ received: true });
});
