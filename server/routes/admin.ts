import { Hono } from 'hono';
import { deleteBlock, insertBlock, listBlocksBetween } from '../db/blocks';
import { listActiveBookingsBetween, listAllBookingsWithClient, type BookingWithClientRow } from '../db/bookings';
import { getStylist, listStylists } from '../db/catalog';
import { STEP_MIN } from '../domain/slots';
import { localDayWindow, localParts, now } from '../domain/time';
import type { Env, Vars } from '../env';
import { AppError } from '../errors';
import { requireAdmin } from '../middleware/guards';
import { parseBody } from '../validate';
import {
  calendarQuerySchema,
  createBlockSchema,
  type AdminBookingDto,
  type BlockDto,
  type CalendarResponse,
} from '../../shared/schemas';
import { toBookingDto } from './bookings';

export const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

function toAdminBookingDto(r: BookingWithClientRow, at: Date): AdminBookingDto {
  return { ...toBookingDto(r, at), client: { name: r.client_name, email: r.client_email } };
}

const onGrid = (d: Date) => d.getTime() % 60_000 === 0 && localParts(d).minutes % STEP_MIN === 0;

admin.get('/admin/calendar', async (c) => {
  requireAdmin(c);
  const q = calendarQuerySchema.safeParse(c.req.query());
  if (!q.success) throw new AppError(400, 'VALIDATION', q.error.issues);
  const { from, to } = localDayWindow(q.data.date);
  const at = now(c.env);
  const [stylists, bookings, blocks] = await Promise.all([
    listStylists(c.env.DB),
    listActiveBookingsBetween(c.env.DB, from, to, at),
    listBlocksBetween(c.env.DB, from, to),
  ]);
  const body: CalendarResponse = {
    stylists: stylists.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar })),
    bookings: bookings.map((r) => toAdminBookingDto(r, at)),
    blocks: blocks.map((b): BlockDto => ({ id: b.id, stylistId: b.stylist_id, start: b.start_at, end: b.end_at })),
  };
  return c.json(body);
});

admin.post('/admin/blocks', async (c) => {
  requireAdmin(c);
  const body = await parseBody(c, createBlockSchema);
  const start = new Date(body.start);
  const end = new Date(body.end);
  if (start.getTime() >= end.getTime() || !onGrid(start) || !onGrid(end)) throw new AppError(400, 'VALIDATION');
  if (!(await getStylist(c.env.DB, body.stylistId))) throw new AppError(400, 'VALIDATION');
  // A block may overlap existing bookings (the admin decides); it only stops new ones.
  const id = await insertBlock(c.env.DB, body.stylistId, start, end);
  return c.json({ id }, 201);
});

admin.delete('/admin/blocks/:id', async (c) => {
  requireAdmin(c);
  if (!(await deleteBlock(c.env.DB, c.req.param('id')))) throw new AppError(404, 'NOT_FOUND');
  return c.body(null, 204);
});

admin.get('/admin/bookings', async (c) => {
  requireAdmin(c);
  const rows = await listAllBookingsWithClient(c.env.DB);
  const at = now(c.env);
  return c.json({ bookings: rows.map((r) => toAdminBookingDto(r, at)) });
});
