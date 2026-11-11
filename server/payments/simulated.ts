import { confirmBookingIfPending, getBooking, type BookingRow } from '../db/bookings';
import { insertPayment } from '../db/payments';
import { classifyTestCard } from '../domain/cards';
import { AppError } from '../errors';
import type { PaymentProvider } from './provider';

/** The simulated provider has no hosted page: the SPA's own payment page posts the card to our API. */
export const simulatedProvider: PaymentProvider = {
  name: 'simulated',
  async start() {
    return {};
  },
};

/**
 * Takes a deposit with a Stripe test card number. Only the last 4 digits are kept; the full number
 * is classified and then dropped. Resolves 'confirmed' also for a booking that was already confirmed.
 * Throws HOLD_EXPIRED (cancelled or expired hold), NOT_TEST_CARD or CARD_DECLINED.
 */
export async function simulatedPay(
  db: D1Database,
  booking: BookingRow,
  cardNumber: string,
  now: Date,
): Promise<'confirmed'> {
  if (booking.status === 'confirmed') return 'confirmed';
  if (booking.status !== 'pending_payment') throw new AppError(409, 'HOLD_EXPIRED');
  if (!booking.hold_until || booking.hold_until <= now.toISOString()) throw new AppError(409, 'HOLD_EXPIRED');

  const kind = classifyTestCard(cardNumber);
  if (kind === 'invalid') throw new AppError(400, 'NOT_TEST_CARD');
  if (kind === 'declined') throw new AppError(402, 'CARD_DECLINED');

  if (!(await confirmBookingIfPending(db, booking.id, now))) {
    // Lost a race: a concurrent payment is idempotent, anything else means the hold is gone.
    const fresh = await getBooking(db, booking.id);
    if (fresh?.status === 'confirmed') return 'confirmed';
    throw new AppError(409, 'HOLD_EXPIRED');
  }
  await insertPayment(
    db,
    {
      booking_id: booking.id,
      provider: 'simulated',
      status: 'succeeded',
      card_last4: cardNumber.replace(/\D/g, '').slice(-4),
      external_id: null,
    },
    now,
  );
  return 'confirmed';
}
