import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import {
  cancelBookingIfStatus,
  confirmBookingIfPending,
  extendHoldIfPending,
  getBooking,
  insertBookingIfFree,
  type NewBooking,
} from '../../server/db/bookings';
import { insertPayment, listPaymentsForBooking } from '../../server/db/payments';
import { handleStripeEvent } from '../../server/payments/stripe';
import { simulatedPay } from '../../server/payments/simulated';

const now = new Date('2026-12-07T08:00:00.000Z');
let n = 0;

async function pending(holdMs = 10 * 60_000): Promise<string> {
  const start = new Date('2026-12-20T08:00:00.000Z');
  const b: NewBooking = {
    id: crypto.randomUUID(),
    userId: 'u1',
    serviceId: 's1',
    stylistId: `st-pay-${++n}`,
    start,
    end: new Date(start.getTime() + 30 * 60_000),
    depositLei: 20,
    holdUntil: new Date(now.getTime() + holdMs),
  };
  expect(await insertBookingIfFree(env.DB, b, now)).toBe(true);
  return b.id;
}

// The pending() bookings have a 20 lei deposit.
const completed = (bookingId: string, sessionId: string, extra: Record<string, unknown> = {}) => ({
  type: 'checkout.session.completed',
  data: {
    object: { id: sessionId, payment_status: 'paid', amount_total: 2000, currency: 'ron', metadata: { bookingId }, ...extra },
  },
});

describe('conditional status changes', () => {
  test('confirm works once, and not after the hold ended', async () => {
    const id = await pending();
    expect(await confirmBookingIfPending(env.DB, id, now)).toBe(true);
    expect(await confirmBookingIfPending(env.DB, id, now)).toBe(false);
    const late = await pending(-1000);
    expect(await confirmBookingIfPending(env.DB, late, now)).toBe(false);
    expect((await getBooking(env.DB, late))?.status).toBe('pending_payment');
  });

  test('a cancel that read an old status changes nothing', async () => {
    const id = await pending();
    await confirmBookingIfPending(env.DB, id, now);
    expect(await cancelBookingIfStatus(env.DB, id, 'pending_payment', false)).toBe(false);
    expect((await getBooking(env.DB, id))?.status).toBe('confirmed');
    expect(await cancelBookingIfStatus(env.DB, id, 'confirmed', true)).toBe(true);
  });

  test('confirm and cancel racing: exactly one wins and the loser changes nothing', async () => {
    const id = await pending();
    const [c, x] = await Promise.all([
      confirmBookingIfPending(env.DB, id, now),
      cancelBookingIfStatus(env.DB, id, 'pending_payment', false),
    ]);
    expect([c, x].filter(Boolean)).toHaveLength(1);
    expect((await getBooking(env.DB, id))?.status).toBe(c ? 'confirmed' : 'cancelled');
  });
});

describe('extendHoldIfPending', () => {
  test('moves the hold of a live pending booking, but not an expired, confirmed or cancelled one', async () => {
    const until = new Date(now.getTime() + 31 * 60_000);
    const live = await pending();
    expect(await extendHoldIfPending(env.DB, live, now, until)).toBe(true);
    expect((await getBooking(env.DB, live))?.hold_until).toBe(until.toISOString());
    expect(await extendHoldIfPending(env.DB, await pending(-1000), now, until)).toBe(false);
    const confirmed = await pending();
    await confirmBookingIfPending(env.DB, confirmed, now);
    expect(await extendHoldIfPending(env.DB, confirmed, now, until)).toBe(false);
    const cancelled = await pending();
    await cancelBookingIfStatus(env.DB, cancelled, 'pending_payment', false);
    expect(await extendHoldIfPending(env.DB, cancelled, now, until)).toBe(false);
  });
});

describe('payments', () => {
  test('a duplicate external_id is ignored, but other constraint errors still raise', async () => {
    const p = { booking_id: 'b', provider: 'stripe', status: 'succeeded', card_last4: null, external_id: 'cs_dup' };
    expect(await insertPayment(env.DB, p, now)).toBe(true);
    expect(await insertPayment(env.DB, p, now)).toBe(false);
    await expect(insertPayment(env.DB, { ...p, external_id: 'cs_other', provider: null as never }, now)).rejects.toThrow();
  });

  test('simulatedPay stores only the last 4 digits', async () => {
    const id = await pending();
    const booking = (await getBooking(env.DB, id))!;
    expect(await simulatedPay(env.DB, booking, '4242 4242 4242 4242', now)).toBe('confirmed');
    const rows = await listPaymentsForBooking(env.DB, id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'simulated', status: 'succeeded', card_last4: '4242', external_id: null });
    expect(JSON.stringify(rows)).not.toContain('4242 4242');
  });
});

describe('handleStripeEvent', () => {
  test.each([
    ['a wrong amount', { amount_total: 100 }],
    ['a missing amount', { amount_total: undefined }],
    ['a wrong currency', { currency: 'usd' }],
  ])('%s is recorded as paid_not_confirmed and leaves the booking alone', async (_name, extra) => {
    const id = await pending();
    await handleStripeEvent(env.DB, completed(id, `cs_${crypto.randomUUID()}`, extra), now);
    expect((await getBooking(env.DB, id))?.status).toBe('pending_payment');
    expect((await listPaymentsForBooking(env.DB, id))[0].status).toBe('paid_not_confirmed');
  });

  test('confirms once and records one payment for a replayed event', async () => {
    const id = await pending();
    await handleStripeEvent(env.DB, completed(id, 'cs_replay'), now);
    await handleStripeEvent(env.DB, completed(id, 'cs_replay'), now);
    expect((await getBooking(env.DB, id))?.status).toBe('confirmed');
    expect(await listPaymentsForBooking(env.DB, id)).toHaveLength(1);
  });

  test('a paid session after the hold ended is recorded but does not confirm', async () => {
    const id = await pending(-1000);
    await handleStripeEvent(env.DB, completed(id, 'cs_late'), now);
    expect((await getBooking(env.DB, id))?.status).toBe('pending_payment');
    expect((await listPaymentsForBooking(env.DB, id))[0].status).toBe('paid_not_confirmed');
  });

  test('other event types, unpaid sessions and unknown bookings are no-ops', async () => {
    const id = await pending();
    await handleStripeEvent(env.DB, { ...completed(id, 'cs_a'), type: 'customer.created' }, now);
    await handleStripeEvent(env.DB, { type: 'checkout.session.completed', data: { object: { id: 'cs_b', payment_status: 'unpaid', metadata: { bookingId: id } } } }, now);
    await handleStripeEvent(env.DB, completed('nu-exista', 'cs_c'), now);
    expect((await getBooking(env.DB, id))?.status).toBe('pending_payment');
    expect(await listPaymentsForBooking(env.DB, id)).toHaveLength(0);
  });
});
