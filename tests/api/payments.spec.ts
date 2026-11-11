import Stripe from 'stripe';
import { RESET_TOKEN } from '../support/reset-token';
import { expect, test, type Client } from '../support/fixtures';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local_test';
const GOOD = { cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };
const DECLINED = { cardNumber: '4000 0000 0000 0002', expiry: '12/30', cvc: '123' };

// Each booking gets its own day (Monday to Saturday), so payment specs never collide with other files.
// A random starting week keeps a retried worker (which restarts the counter) off days it already used.
const firstWeek = Math.floor(Math.random() * 40);
let counter = 0;
function nextStart(): string {
  const d = new Date(Date.UTC(2027, 0, 4)); // Monday 2027-01-04
  d.setUTCDate(d.getUTCDate() + (firstWeek + Math.floor(counter / 6)) * 7 + (counter % 6));
  counter++;
  return `${d.toISOString().slice(0, 10)}T08:00:00.000Z`;
}

async function bookOne(c: Client): Promise<string> {
  const r = await c.request.post('/api/bookings', {
    data: { serviceId: 'tuns-dama', stylistId: 'stylist-iona', start: nextStart() },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).id;
}

const pay = (c: Client, id: string, body: unknown = GOOD) =>
  c.request.post(`/api/payments/${id}/simulated`, { data: body });
const statusOf = async (c: Client, id: string) => (await (await c.request.get(`/api/bookings/${id}`)).json()).status;
const expireHold = (request: Client['request'], id: string) =>
  request.post(`/__demo/fixtures/expire-hold/${id}`, { headers: { 'X-Demo-Reset-Token': RESET_TOKEN } });

test('4242... confirms the booking and returns no card data', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  const r = await pay(c, id, { cardNumber: '4242-4242-4242-4242', expiry: '12/30', cvc: '123' });
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ status: 'confirmed' });
  expect(await statusOf(c, id)).toBe('confirmed');
  // The booking DTO carries no card data at all.
  const dto = await (await c.request.get(`/api/bookings/${id}`)).json();
  expect(JSON.stringify(dto)).not.toMatch(/4242|cvc|expiry|card/i);
});

test('4000...0002 is CARD_DECLINED and the booking stays pending', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  const r = await pay(c, id, DECLINED);
  expect(r.status()).toBe(402);
  expect((await r.json()).error.code).toBe('CARD_DECLINED');
  expect(await statusOf(c, id)).toBe('pending_payment');
});

test('any other number is NOT_TEST_CARD and the booking stays pending', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  for (const cardNumber of ['4111 1111 1111 1111', '1234']) {
    const r = await pay(c, id, { ...GOOD, cardNumber });
    expect(r.status(), cardNumber).toBe(400);
    expect((await r.json()).error.code).toBe('NOT_TEST_CARD');
  }
  expect(await statusOf(c, id)).toBe('pending_payment');
});

test('a malformed body or card shape is VALIDATION', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  for (const body of [{}, { cardNumber: '4242424242424242' }, { ...GOOD, cardNumber: '' }, { ...GOOD, cvc: 'abc' }, { ...GOOD, expiry: 'soon' }]) {
    const r = await pay(c, id, body);
    expect(r.status(), JSON.stringify(body)).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
  expect(await statusOf(c, id)).toBe('pending_payment');
});

test('paying after the hold expired is HOLD_EXPIRED and confirms nothing', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  expect((await expireHold(c.request, id)).status()).toBe(204);
  const r = await pay(c, id);
  expect(r.status()).toBe(409);
  expect((await r.json()).error.code).toBe('HOLD_EXPIRED');
  expect(await statusOf(c, id)).toBe('pending_payment');
});

test('paying a cancelled booking is HOLD_EXPIRED', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  expect((await c.request.post(`/api/bookings/${id}/cancel`)).status()).toBe(200);
  const r = await pay(c, id);
  expect(r.status()).toBe(409);
  expect((await r.json()).error.code).toBe('HOLD_EXPIRED');
  expect(await statusOf(c, id)).toBe('cancelled');
});

test('paying an already confirmed booking is a 200 no-op', async ({ newClient }) => {
  const c = await newClient();
  const id = await bookOne(c);
  expect((await pay(c, id)).status()).toBe(200);
  const again = await pay(c, id);
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual({ status: 'confirmed' });
  expect(await statusOf(c, id)).toBe('confirmed');
});

test("only the owner can pay: someone else's booking is 404, anonymous is 401", async ({ newClient, request }) => {
  const owner = await newClient();
  const other = await newClient();
  const id = await bookOne(owner);
  const r = await pay(other, id);
  expect(r.status()).toBe(404);
  expect((await r.json()).error.code).toBe('NOT_FOUND');
  expect((await pay(other, 'nu-exista')).status()).toBe(404);
  expect((await request.post(`/api/payments/${id}/simulated`, { data: GOOD })).status()).toBe(401);
  expect(await statusOf(owner, id)).toBe('pending_payment');
});

test('expire-hold is token protected', async ({ request }) => {
  expect((await request.post('/__demo/fixtures/expire-hold/x')).status()).toBe(404);
  expect(
    (await request.post('/__demo/fixtures/expire-hold/x', { headers: { 'X-Demo-Reset-Token': 'nope' } })).status(),
  ).toBe(404);
});

test('GET /api/config says whether Stripe is on', async ({ request }) => {
  const r = await request.get('/api/config');
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(typeof body.stripeEnabled).toBe('boolean');
});

test('/stripe is 404 NOT_FOUND when Stripe is not configured', async ({ newClient, request }) => {
  const cfg = await (await request.get('/api/config')).json();
  test.skip(cfg.stripeEnabled, 'Stripe is configured on this target');
  const c = await newClient();
  const id = await bookOne(c);
  const r = await c.request.post(`/api/payments/${id}/stripe`);
  expect(r.status()).toBe(404);
  expect((await r.json()).error.code).toBe('NOT_FOUND');
});

// --- Webhook (local target only: the test secret is a fake that exists only in .dev.vars) ---

const stripe = new Stripe('sk_test_unused_no_network');

function sessionEvent(bookingId: string, eventId = `evt_${crypto.randomUUID()}`, sessionId = `cs_test_${crypto.randomUUID()}`) {
  return {
    id: eventId,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: sessionId, object: 'checkout.session', payment_status: 'paid', metadata: { bookingId } } },
  };
}

async function postWebhook(request: Client['request'], payload: string, signature?: string) {
  return request.post('/api/payments/stripe/webhook', {
    data: payload,
    headers: { 'Content-Type': 'application/json', ...(signature ? { 'Stripe-Signature': signature } : {}) },
  });
}
const sign = (payload: string, secret = WEBHOOK_SECRET) => stripe.webhooks.generateTestHeaderString({ payload, secret });

test.describe('webhook', () => {
  test.beforeEach(({ baseURL }) => {
    test.skip(!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(baseURL ?? ''), 'webhook secret is local-only');
  });

  test('a valid signature confirms the booking', async ({ newClient, request }) => {
    const c = await newClient();
    const id = await bookOne(c);
    const payload = JSON.stringify(sessionEvent(id));
    const r = await postWebhook(request, payload, sign(payload));
    expect(r.status()).toBe(200);
    expect(await statusOf(c, id)).toBe('confirmed');
  });

  test('a bad or missing signature is 400 VALIDATION and changes nothing', async ({ newClient, request }) => {
    const c = await newClient();
    const id = await bookOne(c);
    const payload = JSON.stringify(sessionEvent(id));
    for (const sig of [sign(payload, 'whsec_wrong'), 't=1,v1=deadbeef', undefined]) {
      const r = await postWebhook(request, payload, sig);
      expect(r.status(), String(sig)).toBe(400);
      expect((await r.json()).error.code).toBe('VALIDATION');
    }
    // A tampered body with a signature made for the original one.
    const tampered = JSON.stringify(sessionEvent(id, 'evt_other'));
    expect((await postWebhook(request, tampered, sign(payload))).status()).toBe(400);
    expect(await statusOf(c, id)).toBe('pending_payment');
  });

  test('the same event twice: the second is 200 and changes nothing', async ({ newClient, request }) => {
    const c = await newClient();
    const id = await bookOne(c);
    const payload = JSON.stringify(sessionEvent(id));
    expect((await postWebhook(request, payload, sign(payload))).status()).toBe(200);
    // Cancelling first proves the replay cannot revive the booking.
    expect((await c.request.post(`/api/bookings/${id}/cancel`)).status()).toBe(200);
    const replay = await postWebhook(request, payload, sign(payload));
    expect(replay.status()).toBe(200);
    expect(await statusOf(c, id)).toBe('cancelled');
  });

  test('unknown event types are a 200 no-op', async ({ newClient, request }) => {
    const c = await newClient();
    const id = await bookOne(c);
    const payload = JSON.stringify({ ...sessionEvent(id), type: 'customer.created' });
    expect((await postWebhook(request, payload, sign(payload))).status()).toBe(200);
    expect(await statusOf(c, id)).toBe('pending_payment');
  });

  test('a completed session after the hold expired does not confirm the booking', async ({ newClient, request }) => {
    const c = await newClient();
    const id = await bookOne(c);
    await expireHold(c.request, id);
    const payload = JSON.stringify(sessionEvent(id));
    expect((await postWebhook(request, payload, sign(payload))).status()).toBe(200);
    expect(await statusOf(c, id)).toBe('pending_payment');
  });
});
