import type { Busy } from '../domain/slots';
import { fromLocal } from '../domain/time';

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled';

export type BookingRow = {
  id: string;
  user_id: string;
  service_id: string;
  stylist_id: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  deposit_lei: number;
  hold_until: string | null;
  refunded: number;
  created_at: string;
};

export type NewBooking = {
  id: string;
  userId: string;
  serviceId: string;
  stylistId: string;
  start: Date;
  end: Date;
  depositLei: number;
  holdUntil: Date;
};

/**
 * Inserts a pending_payment booking only if no active booking or block overlaps it.
 * One statement, so D1 applies the check and the insert atomically.
 */
export async function insertBookingIfFree(db: D1Database, b: NewBooking, now: Date): Promise<boolean> {
  const r = await db
    .prepare(
      `INSERT INTO bookings (id,user_id,service_id,stylist_id,start_at,end_at,status,deposit_lei,hold_until,created_at)
       SELECT ?1,?2,?3,?4,?5,?6,'pending_payment',?7,?8,?9
       WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE stylist_id=?4 AND start_at<?6 AND end_at>?5
                         AND (status='confirmed' OR (status='pending_payment' AND hold_until>?9)))
         AND NOT EXISTS (SELECT 1 FROM blocks WHERE stylist_id=?4 AND start_at<?6 AND end_at>?5)`,
    )
    .bind(
      b.id,
      b.userId,
      b.serviceId,
      b.stylistId,
      b.start.toISOString(),
      b.end.toISOString(),
      b.depositLei,
      b.holdUntil.toISOString(),
      now.toISOString(),
    )
    .run();
  return r.meta.changes === 1;
}

export async function getBooking(db: D1Database, id: string): Promise<BookingRow | null> {
  return db.prepare('SELECT * FROM bookings WHERE id = ?1').bind(id).first<BookingRow>();
}

export async function listBookingsForUser(db: D1Database, userId: string): Promise<BookingRow[]> {
  const r = await db
    .prepare('SELECT * FROM bookings WHERE user_id = ?1 ORDER BY start_at')
    .bind(userId)
    .all<BookingRow>();
  return r.results;
}

export async function listAllBookings(db: D1Database): Promise<BookingRow[]> {
  const r = await db.prepare('SELECT * FROM bookings ORDER BY start_at').all<BookingRow>();
  return r.results;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Busy intervals for one Europe/Bucharest local day (YYYY-MM-DD): active bookings plus blocks. */
export async function busyFor(db: D1Database, date: string, now: Date): Promise<Busy[]> {
  const from = fromLocal(date, 0).toISOString();
  const to = fromLocal(nextDay(date), 0).toISOString();
  const [bookings, blocks] = await db.batch([
    db
      .prepare(
        `SELECT stylist_id, start_at, end_at FROM bookings
         WHERE start_at < ?2 AND end_at > ?1
           AND (status='confirmed' OR (status='pending_payment' AND hold_until>?3))`,
      )
      .bind(from, to, now.toISOString()),
    db.prepare('SELECT stylist_id, start_at, end_at FROM blocks WHERE start_at < ?2 AND end_at > ?1').bind(from, to),
  ]);
  type R = { stylist_id: string; start_at: string; end_at: string };
  return [...(bookings.results as R[]), ...(blocks.results as R[])].map((x) => ({
    stylistId: x.stylist_id,
    start: new Date(x.start_at),
    end: new Date(x.end_at),
  }));
}

export async function setBookingStatus(
  db: D1Database,
  id: string,
  status: BookingStatus,
  refunded?: boolean,
): Promise<void> {
  if (refunded === undefined) {
    await db.prepare('UPDATE bookings SET status = ?2 WHERE id = ?1').bind(id, status).run();
  } else {
    await db
      .prepare('UPDATE bookings SET status = ?2, refunded = ?3 WHERE id = ?1')
      .bind(id, status, refunded ? 1 : 0)
      .run();
  }
}
