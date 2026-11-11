import { expect, test, type Client } from '../support/fixtures';

const DAY = '2026-12-28'; // a Monday with no seeded bookings; local time is UTC+2 in December
const VOPSIT_COMPLET = 'vopsit-complet'; // 120 min, 280 lei
const IONA = 'stylist-iona';
const at = (hhmmUtc: string, day = DAY) => `${day}T${hhmmUtc}:00.000Z`;

const book = (c: Client, start: string, serviceId = 'tuns-dama', stylistId = IONA) =>
  c.request.post('/api/bookings', { data: { serviceId, stylistId, start } });

test('the catalog lists services and stylists in camelCase', async ({ request }) => {
  const s = await (await request.get('/api/services')).json();
  expect(s.services).toHaveLength(6);
  expect(s.services.find((x: { id: string }) => x.id === VOPSIT_COMPLET)).toEqual({
    id: VOPSIT_COMPLET,
    name: 'Vopsit complet',
    durationMin: 120,
    priceLei: 280,
  });
  const st = await (await request.get('/api/stylists')).json();
  expect(st.stylists.map((x: { id: string }) => x.id)).toContain(IONA);
});

test('the last offered start for Vopsit complet is 17:00', async ({ request }) => {
  const r = await request.get(`/api/slots?serviceId=${VOPSIT_COMPLET}&date=${DAY}&stylistId=${IONA}`);
  expect(r.status()).toBe(200);
  const { slots } = await r.json();
  expect(slots[0].start).toBe(at('07:00')); // 09:00 local
  expect(slots.at(-1).start).toBe(at('15:00')); // 17:00 local
});

test('slots without a stylist cover every stylist', async ({ request }) => {
  const day = '2026-12-30'; // untouched by the booking tests above
  const { slots } = await (await request.get(`/api/slots?serviceId=tuns-dama&date=${day}`)).json();
  const first = slots.filter((s: { start: string }) => s.start === at('07:00', day));
  expect(first.length).toBe(3);
});

test('slots reject a bad date, an unknown service or an unknown stylist with VALIDATION', async ({ request }) => {
  for (const q of [
    `serviceId=tuns-dama&date=2026-02-30`,
    `serviceId=tuns-dama&date=nope`,
    `serviceId=tuns-dama`,
    `serviceId=nu-exista&date=${DAY}`,
    `serviceId=tuns-dama&date=${DAY}&stylistId=nu-exista`,
  ]) {
    const r = await request.get(`/api/slots?${q}`);
    expect(r.status(), q).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
});

test('booking a free slot returns pending_payment with the deposit', async ({ newClient }) => {
  const c = await newClient();
  const r = await book(c, at('07:15'), VOPSIT_COMPLET, 'stylist-dorina');
  expect(r.status()).toBe(201);
  const b = await r.json();
  expect(b).toMatchObject({ status: 'pending_payment', depositLei: 84, holdUntil: '2026-12-07T08:10:00.000Z' });
  expect(typeof b.id).toBe('string');
  const mine = await (await c.request.get('/api/bookings')).json();
  expect(mine.bookings.map((x: { id: string }) => x.id)).toContain(b.id);
});

test('a held slot disappears from the slot list', async ({ newClient }) => {
  const c = await newClient();
  expect((await book(c, at('08:00'), 'tuns-barbati', 'stylist-lucian')).status()).toBe(201);
  const { slots } = await (
    await c.request.get(`/api/slots?serviceId=tuns-barbati&date=${DAY}&stylistId=stylist-lucian`)
  ).json();
  expect(slots.map((s: { start: string }) => s.start)).not.toContain(at('08:00'));
});

test('booking the same slot twice: second gets 409 SLOT_TAKEN', async ({ newClient }) => {
  const a = await newClient();
  const b = await newClient();
  expect((await book(a, at('09:00'), 'coafat', 'stylist-iona')).status()).toBe(201);
  const r = await book(b, at('09:15'), 'coafat', 'stylist-iona');
  expect(r.status()).toBe(409);
  expect((await r.json()).error.code).toBe('SLOT_TAKEN');
});

test('a start in the past is refused with VALIDATION', async ({ newClient }) => {
  const c = await newClient();
  for (const start of ['2026-12-07T07:00:00.000Z', '2026-12-07T08:00:00.000Z']) {
    const r = await book(c, start);
    expect(r.status(), start).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
});

test('a start that runs past closing is refused with VALIDATION', async ({ newClient }) => {
  const c = await newClient();
  const r = await book(c, at('16:00'), VOPSIT_COMPLET); // 18:00 local + 120 min
  expect(r.status()).toBe(400);
  expect((await r.json()).error.code).toBe('VALIDATION');
});

test('Sunday, off-grid, malformed and unknown inputs are VALIDATION, not 500', async ({ newClient }) => {
  const c = await newClient();
  const cases: unknown[] = [
    { serviceId: 'tuns-dama', stylistId: IONA, start: at('08:00', '2026-12-27') }, // Sunday
    { serviceId: 'tuns-dama', stylistId: IONA, start: at('08:07') }, // off the grid
    { serviceId: 'tuns-dama', stylistId: IONA, start: `${DAY}T08:00:30.000Z` },
    { serviceId: 'tuns-dama', stylistId: IONA, start: 'mâine' },
    { serviceId: 'nu-exista', stylistId: IONA, start: at('08:00') },
    { serviceId: 'tuns-dama', stylistId: 'nu-exista', start: at('08:00') },
    {},
  ];
  for (const data of cases) {
    const r = await c.request.post('/api/bookings', { data });
    expect(r.status(), JSON.stringify(data)).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
});

test('creating a booking without a session is 401', async ({ request }) => {
  const r = await request.post('/api/bookings', { data: { serviceId: 'tuns-dama', stylistId: IONA, start: at('08:00') } });
  expect(r.status()).toBe(401);
  expect((await request.get('/api/bookings')).status()).toBe(401);
  expect((await request.get('/api/bookings/x')).status()).toBe(401);
  expect((await request.post('/api/bookings/x/cancel')).status()).toBe(401);
});

test("another client's booking is 404, but the owner and an admin can read it", async ({ newClient, asAdmin }) => {
  const owner = await newClient();
  const other = await newClient();
  const { id } = await (await book(owner, at('10:00'), 'manichiura', 'stylist-lucian')).json();
  expect((await owner.request.get(`/api/bookings/${id}`)).status()).toBe(200);
  const r = await other.request.get(`/api/bookings/${id}`);
  expect(r.status()).toBe(404);
  expect((await r.json()).error.code).toBe('NOT_FOUND');
  expect((await other.request.get('/api/bookings/nu-exista')).status()).toBe(404);
  const admin = await asAdmin();
  expect((await admin.request.get(`/api/bookings/${id}`)).status()).toBe(200);
});

test("another client cannot cancel a booking (404)", async ({ newClient }) => {
  const owner = await newClient();
  const other = await newClient();
  const { id } = await (await book(owner, at('11:00'), 'manichiura', 'stylist-lucian')).json();
  expect((await other.request.post(`/api/bookings/${id}/cancel`)).status()).toBe(404);
  expect((await (await owner.request.get(`/api/bookings/${id}`)).json()).status).toBe('pending_payment');
});

test('cancel more than 24 h ahead: cancelled (pending has nothing to refund) and idempotent', async ({ newClient }) => {
  const c = await newClient();
  const { id } = await (await book(c, at('12:00'), 'manichiura', 'stylist-lucian')).json();
  const r = await c.request.post(`/api/bookings/${id}/cancel`);
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ status: 'cancelled', refunded: false });
  const again = await c.request.post(`/api/bookings/${id}/cancel`);
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual({ status: 'cancelled', refunded: false });
  // The slot is free again.
  const { slots } = await (
    await c.request.get(`/api/slots?serviceId=manichiura&date=${DAY}&stylistId=stylist-lucian`)
  ).json();
  expect(slots.map((s: { start: string }) => s.start)).toContain(at('12:00'));
});

test('cancel less than 24 h ahead: 409 CANCEL_TOO_LATE', async ({ newClient }) => {
  const c = await newClient();
  // 2026-12-07 at 12:00 local (10:00Z) is two hours after the fixed clock.
  const made = await book(c, '2026-12-07T10:00:00.000Z', 'tuns-barbati', 'stylist-dorina');
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  const r = await c.request.post(`/api/bookings/${id}/cancel`);
  expect(r.status()).toBe(409);
  expect((await r.json()).error.code).toBe('CANCEL_TOO_LATE');
  expect((await (await c.request.get(`/api/bookings/${id}`)).json()).status).toBe('pending_payment');
});
