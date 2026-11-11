import { Hono } from 'hono';
import { busyFor } from '../db/bookings';
import { getService, getStylist, listStylists } from '../db/catalog';
import { computeSlots } from '../domain/slots';
import { now } from '../domain/time';
import type { Env, Vars } from '../env';
import { AppError } from '../errors';
import { slotsQuerySchema, type SlotsResponse } from '../../shared/schemas';

export const slots = new Hono<{ Bindings: Env; Variables: Vars }>();

slots.get('/slots', async (c) => {
  const q = slotsQuerySchema.safeParse(c.req.query());
  if (!q.success) throw new AppError(400, 'VALIDATION', q.error.issues);
  const { serviceId, date, stylistId } = q.data;
  const service = await getService(c.env.DB, serviceId);
  if (!service) throw new AppError(400, 'VALIDATION');
  let stylistIds: string[];
  if (stylistId) {
    if (!(await getStylist(c.env.DB, stylistId))) throw new AppError(400, 'VALIDATION');
    stylistIds = [stylistId];
  } else {
    stylistIds = (await listStylists(c.env.DB)).map((s) => s.id);
  }
  const at = now(c.env);
  const busy = await busyFor(c.env.DB, date, at);
  const checkEnd = !c.var.bugs.has('booking-past-closing'); // BUG:booking-past-closing (start time only)
  const body: SlotsResponse = {
    slots: computeSlots({ date, durationMin: service.duration_min, stylistIds, busy, now: at, checkEnd }),
  };
  return c.json(body);
});
