import { env } from 'cloudflare:test';
import { expect, test } from 'vitest';
import worker from '../../server/index';
import { fitsInDay } from '../../server/domain/slots';
import { resetDatabase } from '../../server/seed/reset';
import { SEED_ACCOUNTS, SERVICES, STYLISTS } from '../../server/seed/data';

const NOW = new Date('2026-12-07T08:00:00.000Z');

async function dump(db: D1Database) {
  const out: Record<string, unknown[]> = {};
  for (const t of ['services', 'stylists', 'users', 'bookings']) {
    out[t] = (await db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()).results;
  }
  return out;
}

async function count(table: string): Promise<number> {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return r?.n ?? 0;
}

test('reset is deterministic and complete', async () => {
  await resetDatabase(env.DB, NOW);
  const first = await dump(env.DB);
  await env.DB.prepare("INSERT INTO login_attempts VALUES ('x','a@b.test','1.1.1.1','2026-12-07T08:00:00Z')").run();
  await env.DB.prepare("INSERT INTO sessions VALUES ('s','u','2027-01-01T00:00:00Z')").run();
  await env.DB.prepare("INSERT INTO payments VALUES ('p','b','fake','succeeded','4242',NULL,'2026-12-07T08:00:00Z')").run();
  await env.DB.prepare("INSERT INTO blocks VALUES ('bl','st','2026-12-08T08:00:00Z','2026-12-08T09:00:00Z')").run();
  await resetDatabase(env.DB, NOW);
  expect(await dump(env.DB)).toEqual(first);
  for (const t of ['login_attempts', 'sessions', 'payments', 'blocks']) expect(await count(t)).toBe(0);
  expect(await count('services')).toBe(6);
  expect(await count('stylists')).toBe(3);
  expect(await count('users')).toBe(3);
  expect(await count('bookings')).toBeGreaterThanOrEqual(35);
  expect(await count('bookings')).toBeLessThanOrEqual(45);
});

test('seed accounts carry public passwords and hashes in the verified format', () => {
  expect(SEED_ACCOUNTS.map((a) => a.email)).toEqual([
    'admin@bucla-verde.test',
    'ana@bucla-verde.test',
    'mihai@bucla-verde.test',
  ]);
  for (const a of SEED_ACCOUNTS) {
    expect(a.password.length).toBeGreaterThanOrEqual(10);
    expect(a.passwordHash).toMatch(/^pbkdf2-sha256\$20000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
  }
  expect(SERVICES.map((s) => s.priceLei)).toEqual([120, 60, 180, 280, 100, 90]);
  expect(STYLISTS.every((s) => s.avatar.startsWith('/avatars/') && s.avatar.endsWith('.svg'))).toBe(true);
});

type B = { stylist_id: string; start_at: string; end_at: string; service_id: string; user_id: string; status: string; deposit_lei: number };

test('seeded bookings fall inside opening hours, within the next 14 days, without overlaps', async () => {
  await resetDatabase(env.DB, NOW);
  const rows = (await env.DB.prepare('SELECT * FROM bookings ORDER BY start_at').all<B>()).results;
  const durations = new Map(SERVICES.map((s) => [s.id, s.durationMin]));
  const clients = new Set(SEED_ACCOUNTS.filter((a) => a.role === 'client').map((a) => a.email));
  const clientIds = new Set(
    (await env.DB.prepare('SELECT id, email FROM users').all<{ id: string; email: string }>()).results
      .filter((u) => clients.has(u.email))
      .map((u) => u.id),
  );
  const limit = NOW.getTime() + 14 * 86_400_000;
  for (const b of rows) {
    const start = new Date(b.start_at);
    const dur = durations.get(b.service_id)!;
    expect(start.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
    expect(start.getTime()).toBeLessThan(limit);
    expect(fitsInDay(start, dur, true)).toBe(true);
    expect(new Date(b.end_at).getTime() - start.getTime()).toBe(dur * 60_000);
    expect(b.status).toBe('confirmed');
    expect(clientIds.has(b.user_id)).toBe(true);
    expect(b.deposit_lei).toBeGreaterThanOrEqual(20);
  }
  for (const s of STYLISTS) {
    const mine = rows.filter((b) => b.stylist_id === s.id);
    for (let i = 1; i < mine.length; i++) {
      expect(new Date(mine[i].start_at).getTime()).toBeGreaterThanOrEqual(new Date(mine[i - 1].end_at).getTime());
    }
  }
});

test('scheduled() calls resetDatabase with now(env)', async () => {
  await resetDatabase(env.DB, NOW);
  const expected = await dump(env.DB);
  await env.DB.prepare('DELETE FROM bookings').run();
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
  await worker.scheduled({ cron: '0 1 * * *', scheduledTime: 0 } as ScheduledController, { ...env, DEMO_NOW: NOW.toISOString() }, ctx);
  await Promise.all(pending);
  expect(await dump(env.DB)).toEqual(expected);
});
