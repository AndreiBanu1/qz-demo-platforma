import { expect, test } from '../support/fixtures';

const BLOCK_DAY = '2027-02-01'; // a Monday no other spec uses; local time is UTC+2 in February
const BOOK_DAY = '2027-02-02'; // a Tuesday no other spec uses
const IONA = 'stylist-iona';
const at = (hhmmUtc: string, day = BLOCK_DAY) => `${day}T${hhmmUtc}:00.000Z`;

test('a client gets 403 and an anonymous caller 401 on every admin route', async ({ request, newClient, baseURL }) => {
  const client = await newClient();
  const routes = [
    { method: 'get', url: `/api/admin/calendar?date=${BLOCK_DAY}` },
    { method: 'get', url: '/api/admin/bookings' },
    { method: 'post', url: '/api/admin/blocks', data: { stylistId: IONA, start: at('07:00'), end: at('08:00') } },
    { method: 'delete', url: '/api/admin/blocks/whatever' },
  ] as const;
  for (const r of routes) {
    const forbidden = await client.request[r.method](r.url, 'data' in r ? { data: r.data } : undefined);
    expect(forbidden.status(), `${r.method} ${r.url} as client`).toBe(403);
    expect((await forbidden.json()).error.code).toBe('FORBIDDEN');
    const anon = await request[r.method](r.url, {
      ...('data' in r ? { data: r.data } : {}),
      headers: { Origin: new URL(baseURL!).origin },
    });
    expect(anon.status(), `${r.method} ${r.url} anonymous`).toBe(401);
    expect((await anon.json()).error.code).toBe('UNAUTHENTICATED');
  }
});

test('a block removes slots from the offer and deleting it restores them', async ({ asAdmin, request }) => {
  const admin = await asAdmin();
  const offered = async () => {
    const r = await request.get(`/api/slots?serviceId=tuns-dama&date=${BLOCK_DAY}&stylistId=${IONA}`);
    return ((await r.json()).slots as { start: string }[]).map((s) => s.start);
  };
  expect(await offered()).toContain(at('08:00'));

  // 10:00-11:00 local: tuns-dama (45 min) starting 10:00, 10:15, 10:30 and 10:45 all overlap
  const created = await admin.request.post('/api/admin/blocks', {
    data: { stylistId: IONA, start: at('08:00'), end: at('09:00') },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  try {
    const during = await offered();
    expect(during).not.toContain(at('08:00'));
    expect(during).not.toContain(at('08:45'));
    expect(during).toContain(at('09:00'));

    const cal = await (await admin.request.get(`/api/admin/calendar?date=${BLOCK_DAY}`)).json();
    expect(cal.blocks).toContainEqual({ id, stylistId: IONA, start: at('08:00'), end: at('09:00') });
    expect(cal.stylists.map((s: { id: string }) => s.id)).toContain(IONA);
  } finally {
    expect((await admin.request.delete(`/api/admin/blocks/${id}`)).status()).toBe(204);
  }
  expect(await offered()).toContain(at('08:00'));
  expect((await admin.request.delete(`/api/admin/blocks/${id}`)).status()).toBe(404);
});

test('block validation: unknown stylist, start not before end, off the 15-minute grid, not ISO', async ({ asAdmin }) => {
  const admin = await asAdmin();
  const bad = [
    { stylistId: 'nu-exista', start: at('08:00'), end: at('09:00') },
    { stylistId: IONA, start: at('09:00'), end: at('08:00') },
    { stylistId: IONA, start: at('08:00'), end: at('08:00') },
    { stylistId: IONA, start: at('08:10'), end: at('09:00') },
    { stylistId: IONA, start: at('08:00'), end: at('09:05') },
    { stylistId: IONA, start: '2027-02-01T08:00:30.000Z', end: at('09:00') },
    { stylistId: IONA, start: 'maine', end: at('09:00') },
    { stylistId: IONA },
  ];
  for (const data of bad) {
    const r = await admin.request.post('/api/admin/blocks', { data });
    expect(r.status(), JSON.stringify(data)).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
  const cal = await (await admin.request.get(`/api/admin/calendar?date=${BLOCK_DAY}`)).json();
  expect(cal.blocks).toEqual([]);
});

test('the calendar rejects a bad date', async ({ asAdmin }) => {
  const admin = await asAdmin();
  for (const q of ['', '?date=nope', '?date=2027-02-30']) {
    const r = await admin.request.get(`/api/admin/calendar${q}`);
    expect(r.status(), q).toBe(400);
    expect((await r.json()).error.code).toBe('VALIDATION');
  }
});

test('a block may overlap an existing booking; the booking stays', async ({ asAdmin, newClient }) => {
  const admin = await asAdmin();
  const client = await newClient();
  const booked = await client.request.post('/api/bookings', {
    data: { serviceId: 'tuns-dama', stylistId: IONA, start: at('09:00', BOOK_DAY) },
  });
  expect(booked.status()).toBe(201);
  const { id: bookingId } = await booked.json();
  const block = await admin.request.post('/api/admin/blocks', {
    data: { stylistId: IONA, start: at('08:30', BOOK_DAY), end: at('10:30', BOOK_DAY) },
  });
  expect(block.status()).toBe(201);
  const { id: blockId } = await block.json();
  try {
    const cal = await (await admin.request.get(`/api/admin/calendar?date=${BOOK_DAY}`)).json();
    expect(cal.bookings.map((b: { id: string }) => b.id)).toContain(bookingId);
  } finally {
    await admin.request.delete(`/api/admin/blocks/${blockId}`);
    await client.request.post(`/api/bookings/${bookingId}/cancel`);
  }
});

test('the calendar and the booking list show client names and emails, never password data', async ({
  asAdmin,
  newClient,
}) => {
  const admin = await asAdmin();
  const client = await newClient();
  const booked = await client.request.post('/api/bookings', {
    data: { serviceId: 'tuns-dama', stylistId: IONA, start: at('11:00', BOOK_DAY) },
  });
  expect(booked.status()).toBe(201);
  const { id } = await booked.json();
  try {
    const calRes = await admin.request.get(`/api/admin/calendar?date=${BOOK_DAY}`);
    const calText = await calRes.text();
    const mine = JSON.parse(calText).bookings.find((b: { id: string }) => b.id === id);
    expect(mine.client).toEqual({ name: client.name, email: client.email });
    expect(mine.stylistId).toBe(IONA);
    expect(calText).not.toMatch(/password|pbkdf2|qz_session/i);

    const listRes = await admin.request.get('/api/admin/bookings');
    expect(listRes.status()).toBe(200);
    const listText = await listRes.text();
    expect(listText).not.toMatch(/password|pbkdf2|qz_session/i);
    const all = JSON.parse(listText).bookings as { id: string; client: { name: string; email: string } }[];
    expect(all.find((b) => b.id === id)?.client.email).toBe(client.email);
    const seeded = all.find((b) => b.id.startsWith('seed-booking-'));
    expect(seeded?.client.email).toMatch(/@bucla-verde\.test$/);
    expect(seeded?.client.name).toMatch(/Demo$/);
  } finally {
    await client.request.post(`/api/bookings/${id}/cancel`);
  }
  const after = await (await admin.request.get(`/api/admin/calendar?date=${BOOK_DAY}`)).json();
  expect(after.bookings.map((b: { id: string }) => b.id)).not.toContain(id);
});
