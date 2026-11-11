import { Hono } from 'hono';
import { listServices, listStylists } from '../db/catalog';
import type { Env, Vars } from '../env';
import type { ServiceDto, StylistDto } from '../../shared/schemas';

export const catalog = new Hono<{ Bindings: Env; Variables: Vars }>();

catalog.get('/services', async (c) => {
  const rows = await listServices(c.env.DB);
  const services: ServiceDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    durationMin: r.duration_min,
    priceLei: r.price_lei,
  }));
  return c.json({ services });
});

catalog.get('/stylists', async (c) => {
  const rows = await listStylists(c.env.DB);
  const stylists: StylistDto[] = rows.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar }));
  return c.json({ stylists });
});
