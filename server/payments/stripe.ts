import Stripe from 'stripe';
import { confirmBookingIfPending, getBooking, type BookingRow } from '../db/bookings';
import { insertPayment } from '../db/payments';
import type { PaymentProvider } from './provider';

/** The slice of the Stripe client we use, so a unit test can pass a fake and never touch the network. */
export type StripeLike = {
  checkout: {
    sessions: {
      create(params: {
        mode: 'payment';
        line_items: {
          quantity: number;
          price_data: { currency: string; unit_amount: number; product_data: { name: string } };
        }[];
        metadata: { bookingId: string };
        expires_at: number;
        success_url: string;
        cancel_url: string;
      }): Promise<{ id: string; url: string | null }>;
    };
  };
};

/** A Stripe client that works in Workers: fetch for HTTP, no Node sockets. */
export function makeStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() });
}

/** `expiresAt` is when the Checkout Session lapses; the caller makes it match the booking's extended hold. */
export function createStripeProvider(client: StripeLike, expiresAt: Date): PaymentProvider {
  return {
    name: 'stripe',
    async start(b: BookingRow, origin: string) {
      const session = await client.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'ron',
              unit_amount: b.deposit_lei * 100,
              product_data: { name: 'Avans programare Bucla Verde' },
            },
          },
        ],
        metadata: { bookingId: b.id },
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        success_url: `${origin}/confirmare/${b.id}`,
        cancel_url: `${origin}/avans/${b.id}`,
      });
      if (!session.url) throw new Error('Stripe returned a Checkout Session without a url');
      return { redirectUrl: session.url };
    },
  };
}

/** Verifies the signature over the raw body; throws when it does not match. */
export function verifyStripeEvent(raw: string, signature: string, secret: string): Promise<Stripe.Event> {
  return Stripe.webhooks.constructEventAsync(raw, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
}

/** The only parts of an event we rely on; `data.object` is narrowed once the type is known. */
export type StripeEventLike = { type: string; data: { object: unknown } };

type CompletedSession = {
  id?: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: { bookingId?: string } | null };

/**
 * Applies a verified event. Only `checkout.session.completed` for a paid session does anything.
 * Replays are harmless: the confirm is conditional and the payment row's external_id (the session id) is unique.
 */
export async function handleStripeEvent(db: D1Database, event: StripeEventLike, now: Date): Promise<void> {
  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object as CompletedSession;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || !session.id || session.payment_status !== 'paid') return;
  const booking = await getBooking(db, bookingId);
  if (!booking) return;

  // The metadata is only a pointer: confirm only when what was paid matches the deposit we asked for.
  const paidRight = session.amount_total === booking.deposit_lei * 100 && session.currency === 'ron';
  const confirmed = paidRight && (await confirmBookingIfPending(db, bookingId, now));
  const after = confirmed || !paidRight ? booking : await getBooking(db, bookingId);
  // Paid, but the hold ended or the booking was cancelled first: record it so the money can be returned by hand.
  const status = confirmed || (paidRight && after?.status === 'confirmed') ? 'succeeded' : 'paid_not_confirmed';
  await insertPayment(
    db,
    { booking_id: bookingId, provider: 'stripe', status, card_last4: null, external_id: session.id },
    now,
  );
}
