import { Hono } from 'hono';
import { z } from 'zod';
import { getBookingAnyOwner, leakyStartLookup } from '../bugs/paths';
import {
  cancelBookingIfStatus,
  getBooking,
  insertBookingIfFree,
  listBookingsForUser,
  type BookingRow,
} from '../db/bookings';
import { getService, getStylist } from '../db/catalog';
import { depositLei } from '../domain/deposit';
import { fitsInDay, STEP_MIN } from '../domain/slots';
import { localParts, now } from '../domain/time';
import type { Env, Vars } from '../env';
import { AppError } from '../errors';
import { requireUser } from '../middleware/guards';
import { parseBody } from '../validate';
import {
  createBookingSchema,
  type BookingDto,
  type CancelBookingResponse,
  type CreateBookingResponse,
} from '../../shared/schemas';

const HOLD_MS = 10 * 60_000;
const CANCEL_NOTICE_MS = 24 * 60 * 60_000;

export function toBookingDto(r: BookingRow, at: Date): BookingDto {
  const expired = r.status === 'pending_payment' && !!r.hold_until && r.hold_until <= at.toISOString();
  return {
    id: r.id,
    serviceId: r.service_id,
    stylistId: r.stylist_id,
    start: r.start_at,
    end: r.end_at,
    status: expired ? 'expired' : r.status,
    depositLei: r.deposit_lei,
    holdUntil: r.hold_until,
    refunded: r.refunded === 1,
  };
}

export const bookings = new Hono<{ Bindings: Env; Variables: Vars }>();

bookings.post('/bookings', async (c) => {
  const user = requireUser(c);
  // BUG:leaky-errors: with the bug on, `start` skips its datetime check and a malformed one reaches the database.
  const leaky = c.var.bugs.has('leaky-errors');
  const body = await parseBody(c, leaky ? createBookingSchema.extend({ start: z.string() }) : createBookingSchema);
  if (leaky && !z.iso.datetime({ offset: true }).safeParse(body.start).success) {
    const failure = await leakyStartLookup(c.env.DB, body.stylistId, body.start); // BUG:leaky-errors
    if (failure) return failure;
  }
  const [service, stylist] = await Promise.all([
    getService(c.env.DB, body.serviceId),
    getStylist(c.env.DB, body.stylistId),
  ]);
  if (!service || !stylist) throw new AppError(400, 'VALIDATION');

  const at = now(c.env);
  const start = new Date(body.start);
  if (start.getTime() <= at.getTime()) throw new AppError(400, 'VALIDATION');
  if (start.getTime() % 60_000 !== 0 || localParts(start).minutes % STEP_MIN !== 0) {
    throw new AppError(400, 'VALIDATION');
  }
  const checkEnd = !c.var.bugs.has('booking-past-closing'); // BUG:booking-past-closing (start time only)
  if (!fitsInDay(start, service.duration_min, checkEnd)) throw new AppError(400, 'VALIDATION');

  const id = crypto.randomUUID();
  const deposit = depositLei(service.price_lei);
  const holdUntil = new Date(at.getTime() + HOLD_MS);
  const ok = await insertBookingIfFree(
    c.env.DB,
    {
      id,
      userId: user.id,
      serviceId: service.id,
      stylistId: stylist.id,
      start,
      end: new Date(start.getTime() + service.duration_min * 60_000),
      depositLei: deposit,
      holdUntil,
    },
    at,
  );
  if (!ok) throw new AppError(409, 'SLOT_TAKEN');
  const res: CreateBookingResponse = {
    id,
    status: 'pending_payment',
    depositLei: deposit,
    holdUntil: holdUntil.toISOString(),
  };
  return c.json(res, 201);
});

bookings.get('/bookings', async (c) => {
  const user = requireUser(c);
  const rows = await listBookingsForUser(c.env.DB, user.id);
  const at = now(c.env);
  return c.json({ bookings: rows.map((r) => toBookingDto(r, at)) });
});

bookings.get('/bookings/:id', async (c) => {
  const user = requireUser(c);
  // BUG:idor-booking returns the booking whoever owns it; clean mode is 404 for someone else's, so ids cannot be probed.
  const idor = c.var.bugs.has('idor-booking');
  const row = idor ? await getBookingAnyOwner(c.env.DB, c.req.param('id')) : await getBooking(c.env.DB, c.req.param('id'));
  if (!row || (!idor && row.user_id !== user.id && user.role !== 'admin')) throw new AppError(404, 'NOT_FOUND');
  return c.json(toBookingDto(row, now(c.env)));
});

bookings.post('/bookings/:id/cancel', async (c) => {
  const user = requireUser(c);
  // Statuses only move forward (pending -> confirmed -> cancelled), so one retry covers a concurrent pay.
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await getBooking(c.env.DB, c.req.param('id'));
    if (!row || row.user_id !== user.id) throw new AppError(404, 'NOT_FOUND');
    if (row.status === 'cancelled') {
      const same: CancelBookingResponse = { status: 'cancelled', refunded: row.refunded === 1 };
      return c.json(same);
    }
    if (new Date(row.start_at).getTime() - now(c.env).getTime() < CANCEL_NOTICE_MS) {
      throw new AppError(409, 'CANCEL_TOO_LATE');
    }
    const refunded = row.status === 'confirmed';
    // Conditional on the status we just read: if a payment landed in between, 0 rows change and we re-read.
    if (await cancelBookingIfStatus(c.env.DB, row.id, row.status, refunded)) {
      const res: CancelBookingResponse = { status: 'cancelled', refunded };
      return c.json(res);
    }
  }
  throw new Error('booking status kept changing during cancel');
});
