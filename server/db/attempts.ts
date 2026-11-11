export async function recordFailure(db: D1Database, email: string, ip: string, at: Date): Promise<void> {
  await db
    .prepare('INSERT INTO login_attempts (id,email,ip,at) VALUES (?1,?2,?3,?4)')
    .bind(crypto.randomUUID(), email, ip, at.toISOString())
    .run();
}

/** Failures since `since` for the given email and/or ip (whichever is passed). */
export async function countFailures(
  db: D1Database,
  by: { email?: string; ip?: string },
  since: Date,
): Promise<number> {
  const column = by.email !== undefined ? 'email' : 'ip';
  const value = by.email ?? by.ip;
  if (value === undefined) return 0;
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE ${column} = ?1 AND at >= ?2`)
    .bind(value, since.toISOString())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function clearAttempts(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM login_attempts').run();
}
