import { env } from 'cloudflare:test';
import { expect, test } from 'vitest';
import { getUserByEmail, insertUser } from '../../server/db/users';

const base = { name: 'A', role: 'client' as const, password_hash: 'x', created_at: '2026-12-07T08:00:00.000Z' };

test('insertUser returns false for a duplicate email but still raises on other violations', async () => {
  expect(await insertUser(env.DB, { ...base, id: 'u-1', email: 'dup@x.test' })).toBe(true);
  expect(await insertUser(env.DB, { ...base, id: 'u-2', email: 'dup@x.test' })).toBe(false);
  expect((await getUserByEmail(env.DB, 'dup@x.test'))?.id).toBe('u-1');
  await expect(
    insertUser(env.DB, { ...base, id: 'u-3', email: 'bad@x.test', role: 'root' as unknown as 'client' }),
  ).rejects.toThrow();
});
