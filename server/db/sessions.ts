export type SessionRow = { id: string; user_id: string; expires_at: string };

export async function createSession(db: D1Database, userId: string, expiresAt: Date): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?1,?2,?3)')
    .bind(id, userId, expiresAt.toISOString())
    .run();
  return id;
}

/** The session, only if it has not expired at `now`. */
export async function getSession(db: D1Database, id: string, now: Date): Promise<SessionRow | null> {
  return db
    .prepare('SELECT * FROM sessions WHERE id = ?1 AND expires_at > ?2')
    .bind(id, now.toISOString())
    .first<SessionRow>();
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?1').bind(id).run();
}
