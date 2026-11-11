import { expect, it } from 'vitest';
import { assertNoLiveKeys } from '../../server/domain/keys';

it('rejects live Stripe keys only', () => {
  expect(() => assertNoLiveKeys({ STRIPE_SECRET_KEY: 'sk_live_x' })).toThrow();
  expect(() => assertNoLiveKeys({ STRIPE_WEBHOOK_SECRET: 'whsec_live_x' })).toThrow();
  expect(() => assertNoLiveKeys({ STRIPE_SECRET_KEY: 'sk_test_x' })).not.toThrow();
  expect(() => assertNoLiveKeys({ OTHER: 'sk_live_x', STRIPE_ENABLED: true })).not.toThrow();
});
