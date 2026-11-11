import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { insertBlock } from '../../server/db/blocks';
import {
  busyFor,
  getBooking,
  insertBookingIfFree,
  listAllBookings,
  listBookingsForUser,
  setBookingStatus,
  type NewBooking,
} from '../../server/db/bookings';
import { fromLocal } from '../../server/domain/time';

const now = new Date('2026-12-07T08:00:00.000Z');
let n = 0;

/** A booking on `date` (default a fresh stylist per call so tests stay independent). */
function booking(a: { start: string; min: number; stylist?: string; date?: string; hold?: Date; user?: string }): NewBooking {
  const [h, m] = a.start.split(':').map(Number);
  const start = fromLocal(a.date ?? '2026-12-08', h * 60 + m);
  return {
    id: crypto.randomUUID(),
    userId: a.user ?? 'u1',
    serviceId: 's1',
    stylistId: a.stylist ?? `st-${++n}`,
    start,
    end: new Date(start.getTime() + a.min * 60_000),
    depositLei: 20,
    holdUntil: a.hold ?? new Date(now.getTime() + 10 * 60_000),
  };
}

describe('insertBookingIfFree', () => {
  test('two overlapping inserts: only one succeeds', async () => {
    const stylist = 'st-race';
    const a = insertBookingIfFree(env.DB, booking({ stylist, start: '10:00', min: 60 }), now);
    const b = insertBookingIfFree(env.DB, booking({ stylist, start: '10:30', min: 30 }), now);
    expect((await Promise.all([a, b])).filter(Boolean)).toHaveLength(1);
  });

  test('back-to-back bookings do not overlap', async () => {
    const stylist = 'st-adjacent';
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '10:00', min: 60 }), now)).toBe(true);
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '11:00', min: 30 }), now)).toBe(true);
  });

  test('a different stylist is not blocked', async () => {
    await insertBookingIfFree(env.DB, booking({ stylist: 'st-x', start: '10:00', min: 60 }), now);
    expect(await insertBookingIfFree(env.DB, booking({ stylist: 'st-y', start: '10:00', min: 60 }), now)).toBe(true);
  });

  test('an expired pending hold does not block the slot', async () => {
    const stylist = 'st-expired';
    const expired = booking({ stylist, start: '10:00', min: 60, hold: new Date(now.getTime() - 1000) });
    expect(await insertBookingIfFree(env.DB, expired, now)).toBe(true);
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '10:00', min: 60 }), now)).toBe(true);
  });

  test('a live pending hold blocks the slot', async () => {
    const stylist = 'st-live';
    await insertBookingIfFree(env.DB, booking({ stylist, start: '10:00', min: 60 }), now);
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '10:15', min: 30 }), now)).toBe(false);
  });

  test('a confirmed booking blocks the slot even after its hold time', async () => {
    const stylist = 'st-confirmed';
    const b = booking({ stylist, start: '10:00', min: 60 });
    await insertBookingIfFree(env.DB, b, now);
    await setBookingStatus(env.DB, b.id, 'confirmed');
    const later = new Date(now.getTime() + 3600_000);
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '10:00', min: 60 }), later)).toBe(false);
  });

  test('a cancelled booking does not block the slot', async () => {
    const stylist = 'st-cancelled';
    const b = booking({ stylist, start: '10:00', min: 60 });
    await insertBookingIfFree(env.DB, b, now);
    await setBookingStatus(env.DB, b.id, 'cancelled', true);
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '10:00', min: 60 }), now)).toBe(true);
  });

  test('an admin block blocks the slot', async () => {
    const stylist = 'st-blocked';
    const start = fromLocal('2026-12-08', 10 * 60);
    await insertBlock(env.DB, stylist, start, new Date(start.getTime() + 3600_000));
    expect(await insertBookingIfFree(env.DB, booking({ stylist, start: '10:30', min: 30 }), now)).toBe(false);
  });
});

describe('reads', () => {
  test('getBooking, setBookingStatus and the list functions', async () => {
    const b = booking({ start: '12:00', min: 30, user: 'u-list' });
    await insertBookingIfFree(env.DB, b, now);
    expect((await getBooking(env.DB, b.id))?.status).toBe('pending_payment');
    expect(await getBooking(env.DB, 'missing')).toBeNull();
    await setBookingStatus(env.DB, b.id, 'cancelled', true);
    const row = await getBooking(env.DB, b.id);
    expect(row).toMatchObject({ status: 'cancelled', refunded: 1 });
    expect((await listBookingsForUser(env.DB, 'u-list')).map((x) => x.id)).toEqual([b.id]);
    expect((await listAllBookings(env.DB)).some((x) => x.id === b.id)).toBe(true);
  });

  test('busyFor returns active bookings and blocks of that local day only', async () => {
    const stylist = 'st-busy';
    const date = '2027-01-12';
    const live = booking({ stylist, date, start: '09:00', min: 60 });
    const expired = booking({ stylist, date, start: '11:00', min: 60, hold: new Date(now.getTime() - 1000) });
    const cancelled = booking({ stylist, date, start: '13:00', min: 60 });
    const otherDay = booking({ stylist, date: '2027-01-13', start: '09:00', min: 60 });
    for (const x of [live, expired, cancelled, otherDay]) await insertBookingIfFree(env.DB, x, new Date(now.getTime() - 5000));
    await setBookingStatus(env.DB, cancelled.id, 'cancelled');
    const blockStart = fromLocal(date, 15 * 60);
    await insertBlock(env.DB, stylist, blockStart, new Date(blockStart.getTime() + 3600_000));

    const busy = (await busyFor(env.DB, date, now)).filter((x) => x.stylistId === stylist);
    expect(busy.map((x) => x.start.toISOString()).sort()).toEqual([live.start, blockStart].map((d) => d.toISOString()).sort());
    expect(busy[0].end.getTime()).toBeGreaterThan(busy[0].start.getTime());
  });
});
