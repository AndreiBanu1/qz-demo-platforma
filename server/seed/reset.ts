import { depositLei } from '../domain/deposit';
import { fitsInDay, CLOSE_MIN, OPEN_MIN, STEP_MIN } from '../domain/slots';
import { fromLocal, localParts } from '../domain/time';
import { SEED_ACCOUNTS, SERVICES, STYLISTS } from './data';

const PRNG_SEED = 2026;
const TARGET_BOOKINGS = 40;
const MAX_ATTEMPTS = 4000;
const DAYS_AHEAD = 14;
const TABLES = ['login_attempts', 'sessions', 'payments', 'bookings', 'blocks', 'users', 'stylists', 'services'];

/** Small deterministic PRNG: the same seed always yields the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SeedBooking = {
  id: string;
  userId: string;
  serviceId: string;
  stylistId: string;
  start: Date;
  end: Date;
  depositLei: number;
};

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** About 40 confirmed bookings over the next 14 days, identical for the same `now`. */
export function generateBookings(now: Date): SeedBooking[] {
  const rand = mulberry32(PRNG_SEED);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
  const clients = SEED_ACCOUNTS.filter((a) => a.role === 'client');
  const today = localParts(now).date;
  const slotsPerDay = (CLOSE_MIN - OPEN_MIN) / STEP_MIN;
  const kept: Omit<SeedBooking, 'id'>[] = [];

  for (let i = 0; i < MAX_ATTEMPTS && kept.length < TARGET_BOOKINGS; i++) {
    const day = addDays(today, Math.floor(rand() * DAYS_AHEAD));
    const start = fromLocal(day, OPEN_MIN + Math.floor(rand() * slotsPerDay) * STEP_MIN);
    const service = pick(SERVICES);
    const stylist = pick(STYLISTS);
    const user = pick(clients);
    if (start.getTime() < now.getTime()) continue;
    if (!fitsInDay(start, service.durationMin, true)) continue;
    const end = new Date(start.getTime() + service.durationMin * 60_000);
    const clash = kept.some(
      (b) => b.stylistId === stylist.id && b.start.getTime() < end.getTime() && b.end.getTime() > start.getTime(),
    );
    if (clash) continue;
    kept.push({
      userId: user.id,
      serviceId: service.id,
      stylistId: stylist.id,
      start,
      end,
      depositLei: depositLei(service.priceLei),
    });
  }

  return kept
    .sort((a, b) => a.start.getTime() - b.start.getTime() || (a.stylistId < b.stylistId ? -1 : 1))
    .map((b, i) => ({ ...b, id: `seed-booking-${String(i + 1).padStart(2, '0')}` }));
}

/** Wipes every table and re-inserts the seed in one atomic D1 batch. */
export async function resetDatabase(db: D1Database, now: Date): Promise<void> {
  const stamp = now.toISOString();
  const statements: D1PreparedStatement[] = TABLES.map((t) => db.prepare(`DELETE FROM ${t}`));

  SERVICES.forEach((s, i) =>
    statements.push(
      db
        .prepare('INSERT INTO services (id,name,duration_min,price_lei,sort) VALUES (?1,?2,?3,?4,?5)')
        .bind(s.id, s.name, s.durationMin, s.priceLei, i),
    ),
  );
  STYLISTS.forEach((s, i) =>
    statements.push(
      db.prepare('INSERT INTO stylists (id,name,avatar,sort) VALUES (?1,?2,?3,?4)').bind(s.id, s.name, s.avatar, i),
    ),
  );
  for (const a of SEED_ACCOUNTS) {
    statements.push(
      db
        .prepare('INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES (?1,?2,?3,?4,?5,?6)')
        .bind(a.id, a.email, a.name, a.role, a.passwordHash, stamp),
    );
  }
  for (const b of generateBookings(now)) {
    statements.push(
      db
        .prepare(
          `INSERT INTO bookings (id,user_id,service_id,stylist_id,start_at,end_at,status,deposit_lei,hold_until,refunded,created_at)
           VALUES (?1,?2,?3,?4,?5,?6,'confirmed',?7,NULL,0,?8)`,
        )
        .bind(b.id, b.userId, b.serviceId, b.stylistId, b.start.toISOString(), b.end.toISOString(), b.depositLei, stamp),
    );
  }
  await db.batch(statements);
}
