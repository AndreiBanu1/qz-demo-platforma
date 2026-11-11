export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'admin';
  password_hash: string;
  created_at: string;
};

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<UserRow>();
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first<UserRow>();
}

/** Returns false when the email is already taken. */
export async function insertUser(db: D1Database, u: UserRow): Promise<boolean> {
  const r = await db
    .prepare(
      'INSERT INTO users (id,email,name,role,password_hash,created_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(email) DO NOTHING',
    )
    .bind(u.id, u.email, u.name, u.role, u.password_hash, u.created_at)
    .run();
  return r.meta.changes === 1;
}

export async function deleteUserByEmail(db: D1Database, email: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE email = ?1').bind(email).run();
}
