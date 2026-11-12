// Booking-day load test for the LOCAL copy only (spec 8 and 9).
//
//   npm run start:test                                   # in another terminal
//   k6 run -e TARGET=http://127.0.0.1:8787 tests/load/booking-day.js
//
// setup() refuses any host but 127.0.0.1 and localhost, then resets the local database. Two scenarios run:
//   booking-day: 20 users for DURATION (default 60s): home -> services -> slots -> book -> simulated pay (4242).
//   race:        20 users try to book the same slot at the same moment. Exactly one may win.
// teardown() reads every booking as the admin and fails the run if a stylist is double-booked.
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const TARGET = (__ENV.TARGET || 'http://127.0.0.1:8787').replace(/\/$/, '');
const DURATION = __ENV.DURATION || '60s';
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

// Single sources: the local reset token and the public demo admin account.
const RESET_TOKEN = /^DEMO_RESET_TOKEN=(.*)$/m.exec(open('../../.dev.vars.example'))[1].trim();
const ADMIN = /email: '(admin@[^']+)'[^}]*password: '([^']+)'/.exec(open('../../shared/demo-accounts.ts'));

// The local Worker runs with DEMO_NOW = 2026-12-07T08:00Z (Monday, 10:00 in Bucharest), so these days are ahead.
const BOOKING_DAYS = ['2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-14', '2026-12-15'];
const RACE = { serviceId: 'tuns-dama', stylistId: 'stylist-iona', start: '2026-12-28T08:00:00.000Z' };
const CARD = { cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };

const raceWins = new Counter('race_wins');
const doubleBookings = new Counter('double_bookings');

// A 409 SLOT_TAKEN is the expected answer when two users want one slot, so it is not a failed request.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 409));

export const options = {
  scenarios: {
    'booking-day': { executor: 'constant-vus', vus: 20, duration: DURATION, exec: 'bookingDay' },
    race: { executor: 'per-vu-iterations', vus: 20, iterations: 1, exec: 'race', maxDuration: '60s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:slots}': ['p(95)<800'],
    race_wins: ['count==1'],
    double_bookings: ['count==0'],
  },
};

function hostOf(url) {
  const m = /^https?:\/\/(\[[^\]]+\]|[^/:]+)/i.exec(url);
  return m ? m[1].toLowerCase() : '';
}

/** The session cookie is Secure, which k6's jar won't send over http://127.0.0.1, so it is carried by hand. */
function login(email, password) {
  const res = http.post(`${TARGET}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: jsonHeaders(),
    tags: { name: 'login' },
  });
  const cookie = res.cookies.qz_session && res.cookies.qz_session[0];
  if (res.status !== 200 || !cookie) throw new Error(`login failed for ${email}: ${res.status}`);
  return `qz_session=${cookie.value}`;
}

function jsonHeaders(cookie) {
  const h = { 'Content-Type': 'application/json', Origin: TARGET };
  if (cookie) h.Cookie = cookie;
  return h;
}

/** A fresh client account with a reserved .test address, logged in. */
function newClient(label) {
  const email = `load-${label}-${exec.vu.idInTest}-${exec.vu.iterationInScenario}-${Date.now()}@bucla-verde.test`;
  const password = 'Load-Test-Parola-1';
  const res = http.post(`${TARGET}/api/auth/signup`, JSON.stringify({ name: 'Client Load', email, password }), {
    headers: jsonHeaders(),
    tags: { name: 'signup' },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status}`);
  return login(email, password);
}

export function setup() {
  if (!LOCAL_HOSTS.includes(hostOf(TARGET))) {
    exec.test.abort(`Load tests run only against 127.0.0.1 or localhost, not ${hostOf(TARGET) || TARGET}`);
  }
  const res = http.post(`${TARGET}/__demo/reset`, null, { headers: { 'X-Demo-Reset-Token': RESET_TOKEN } });
  if (res.status !== 204) exec.test.abort(`reset failed: ${res.status}`);
  // Every race user waits for this moment, so their bookings arrive together.
  return { raceAt: Date.now() + 5000 };
}

let session; // one client per VU in the booking-day scenario

export function bookingDay() {
  if (!session) session = newClient('day');
  check(http.get(`${TARGET}/`, { tags: { name: 'home' } }), { 'home 200': (r) => r.status === 200 });

  const services = http.get(`${TARGET}/api/services`, { tags: { name: 'services' } }).json('services');
  const service = services[Math.floor(Math.random() * services.length)];
  const day = BOOKING_DAYS[Math.floor(Math.random() * BOOKING_DAYS.length)];
  const slotsRes = http.get(`${TARGET}/api/slots?serviceId=${service.id}&date=${day}`, { tags: { name: 'slots' } });
  check(slotsRes, { 'slots 200': (r) => r.status === 200 });
  const slots = slotsRes.json('slots');
  if (!slots || slots.length === 0) return sleep(1);

  const slot = slots[Math.floor(Math.random() * slots.length)];
  const booking = http.post(
    `${TARGET}/api/bookings`,
    JSON.stringify({ serviceId: service.id, stylistId: slot.stylistId, start: slot.start }),
    { headers: jsonHeaders(session), tags: { name: 'book', expected: 'true' } },
  );
  check(booking, { 'booked or slot taken': (r) => r.status === 201 || r.status === 409 });
  if (booking.status === 201) {
    const pay = http.post(`${TARGET}/api/payments/${booking.json('id')}/simulated`, JSON.stringify(CARD), {
      headers: jsonHeaders(session),
      tags: { name: 'pay' },
    });
    check(pay, { 'paid and confirmed': (r) => r.status === 200 && r.json('status') === 'confirmed' });
  }
  sleep(1);
}

export function race(data) {
  const cookie = newClient('race');
  const wait = (data.raceAt - Date.now()) / 1000;
  if (wait > 0) sleep(wait);
  const res = http.post(`${TARGET}/api/bookings`, JSON.stringify(RACE), {
    headers: jsonHeaders(cookie),
    tags: { name: 'race', expected: 'true' },
  });
  check(res, { 'race: booked or slot taken': (r) => r.status === 201 || r.status === 409 });
  if (res.status === 201) raceWins.add(1);
}

export function teardown() {
  const cookie = login(ADMIN[1], ADMIN[2]);
  const res = http.get(`${TARGET}/api/admin/bookings`, { headers: jsonHeaders(cookie), tags: { name: 'admin' } });
  if (res.status !== 200) exec.test.fail(`admin bookings failed: ${res.status}`);
  const active = res.json('bookings').filter((b) => b.status === 'pending_payment' || b.status === 'confirmed');
  const byStylist = {};
  for (const b of active) (byStylist[b.stylistId] = byStylist[b.stylistId] || []).push(b);
  let overlaps = 0;
  for (const list of Object.values(byStylist)) {
    list.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    let latest = list[0]; // the booking that ends last so far, so a short booking inside a long one is caught too
    for (let i = 1; i < list.length; i++) {
      if (Date.parse(list[i].start) < Date.parse(latest.end)) {
        overlaps++;
        console.error(`double booking: ${latest.id} and ${list[i].id} (${list[i].stylistId})`);
      }
      if (Date.parse(list[i].end) > Date.parse(latest.end)) latest = list[i];
    }
  }
  doubleBookings.add(overlaps);
  console.log(`teardown: ${active.length} active bookings checked, ${overlaps} overlaps`);
  if (overlaps > 0) exec.test.fail(`${overlaps} double bookings`);
}
