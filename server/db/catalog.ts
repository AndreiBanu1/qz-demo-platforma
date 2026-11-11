export type ServiceRow = { id: string; name: string; duration_min: number; price_lei: number; sort: number };
export type StylistRow = { id: string; name: string; avatar: string; sort: number };

export async function listServices(db: D1Database): Promise<ServiceRow[]> {
  const r = await db.prepare('SELECT * FROM services ORDER BY sort, id').all<ServiceRow>();
  return r.results;
}

export async function getService(db: D1Database, id: string): Promise<ServiceRow | null> {
  return db.prepare('SELECT * FROM services WHERE id = ?1').bind(id).first<ServiceRow>();
}

export async function listStylists(db: D1Database): Promise<StylistRow[]> {
  const r = await db.prepare('SELECT * FROM stylists ORDER BY sort, id').all<StylistRow>();
  return r.results;
}

export async function getStylist(db: D1Database, id: string): Promise<StylistRow | null> {
  return db.prepare('SELECT * FROM stylists WHERE id = ?1').bind(id).first<StylistRow>();
}
