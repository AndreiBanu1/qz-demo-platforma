import { describe, expect, test, vi } from 'vitest';
import { createStripeProvider, type StripeLike } from '../../server/payments/stripe';
import type { BookingRow } from '../../server/db/bookings';

const booking: BookingRow = {
  id: 'b-1',
  user_id: 'u-1',
  service_id: 'vopsit-complet',
  stylist_id: 'stylist-iona',
  start_at: '2026-12-08T08:00:00.000Z',
  end_at: '2026-12-08T10:00:00.000Z',
  status: 'pending_payment',
  deposit_lei: 84,
  hold_until: '2026-12-07T08:10:00.000Z',
  refunded: 0,
  created_at: '2026-12-07T08:00:00.000Z',
};

const EXPIRES = new Date('2026-12-07T08:30:00.000Z');

function fakeClient(url: string | null = 'https://checkout.stripe.test/c/pay/cs_test_1') {
  const create = vi.fn<StripeLike['checkout']['sessions']['create']>(async () => ({ id: 'cs_test_1', url }));
  const client: StripeLike = { checkout: { sessions: { create } } };
  return { client, create };
}

describe('createStripeProvider', () => {
  test('creates a payment-mode Checkout Session in ron for the deposit', async () => {
    const { client, create } = fakeClient();
    const out = await createStripeProvider(client, EXPIRES).start(booking, 'https://demo.example');
    expect(out).toEqual({ redirectUrl: 'https://checkout.stripe.test/c/pay/cs_test_1' });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: 'payment',
      expires_at: 1796632200, // 2026-12-07T08:30:00Z as unix seconds
      metadata: { bookingId: 'b-1' },
      success_url: 'https://demo.example/confirmare/b-1',
      cancel_url: 'https://demo.example/avans/b-1',
    });
    const [item] = params.line_items;
    expect(item.quantity).toBe(1);
    expect(item.price_data.currency).toBe('ron');
    expect(item.price_data.unit_amount).toBe(8400);
  });

  test('is named stripe and fails loudly when Stripe returns no url', async () => {
    const { client } = fakeClient(null);
    const provider = createStripeProvider(client, EXPIRES);
    expect(provider.name).toBe('stripe');
    await expect(provider.start(booking, 'https://demo.example')).rejects.toThrow();
  });
});
