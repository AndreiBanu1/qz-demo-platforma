// Every bug-only code path lives here. Routes call these behind `bugs.has('<id>')`, marked `// BUG:<id>`.
import { getBooking, type BookingRow } from '../db/bookings';

/** slow-login: a planted delay standing in for a slow query. */
export async function slowLoginDelay(ms = 3000): Promise<void> {
  const s = (globalThis as { scheduler?: { wait?: (ms: number) => Promise<void> } }).scheduler;
  if (s?.wait) await s.wait(ms);
  else await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** login-enumeration: tells the caller which half of the credentials was wrong. */
export function enumerationError(accountExists: boolean): { error: { code: 'INVALID_CREDENTIALS'; message: string } } {
  return {
    error: {
      code: 'INVALID_CREDENTIALS',
      message: accountExists ? 'Parola este greșită' : 'Nu există niciun cont cu acest email',
    },
  };
}

/** idor-booking: returns the booking whoever owns it. */
export function getBookingAnyOwner(db: D1Database, id: string): Promise<BookingRow | null> {
  return getBooking(db, id);
}

const LEAKY_SQL = 'SELECT id, start_at FROM bookings WHERE stylist_id = ?1 AND start_at < ?2';

/**
 * leaky-errors: looks the raw `start` up in D1 and turns it into a date without validating it.
 * A malformed value fails here, and the failure is returned with its message, stack and SQL.
 * A value that happens to parse returns null so the normal booking checks carry on.
 */
export async function leakyStartLookup(db: D1Database, stylistId: string, rawStart: string): Promise<Response | null> {
  try {
    await db.prepare(LEAKY_SQL).bind(stylistId, rawStart).all();
    new Date(rawStart).toISOString(); // throws RangeError for "2026-13-45T99:00"
    return null;
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: String(e), stack: err.stack, sql: LEAKY_SQL }, { status: 500 });
  }
}
