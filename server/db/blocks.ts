export type BlockRow = { id: string; stylist_id: string; start_at: string; end_at: string };

export async function insertBlock(db: D1Database, stylistId: string, start: Date, end: Date): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO blocks (id,stylist_id,start_at,end_at) VALUES (?1,?2,?3,?4)')
    .bind(id, stylistId, start.toISOString(), end.toISOString())
    .run();
  return id;
}

export async function deleteBlock(db: D1Database, id: string): Promise<boolean> {
  const r = await db.prepare('DELETE FROM blocks WHERE id = ?1').bind(id).run();
  return r.meta.changes === 1;
}

export async function listBlocksBetween(db: D1Database, from: Date, to: Date): Promise<BlockRow[]> {
  const r = await db
    .prepare('SELECT * FROM blocks WHERE start_at < ?2 AND end_at > ?1 ORDER BY start_at')
    .bind(from.toISOString(), to.toISOString())
    .all<BlockRow>();
  return r.results;
}
