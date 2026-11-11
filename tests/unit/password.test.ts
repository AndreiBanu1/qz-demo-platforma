import { expect, test } from 'vitest';
import { hashPassword, verifyPassword } from '../../server/auth/password';

test('a password verifies against its own hash and not against another', async () => {
  const stored = await hashPassword('parola-lunga-1', 1000);
  expect(stored).toMatch(/^pbkdf2-sha256\$1000\$[^$]+\$[^$]+$/);
  expect(await verifyPassword('parola-lunga-1', stored)).toBe(true);
  expect(await verifyPassword('alta-parola-1', stored)).toBe(false);
});

test('two hashes of one password differ (random salt)', async () => {
  expect(await hashPassword('parola-lunga-1', 1000)).not.toBe(await hashPassword('parola-lunga-1', 1000));
});

test('verify reads the iteration count from the stored string', async () => {
  const stored = await hashPassword('parola-lunga-1', 2000);
  expect(await verifyPassword('parola-lunga-1', stored)).toBe(true);
  expect(await verifyPassword('parola-lunga-1', stored.replace('$2000$', '$1000$'))).toBe(false);
});

test('malformed stored values never verify', async () => {
  for (const bad of ['', 'x', 'bcrypt$1$a$b', 'pbkdf2-sha256$0$a$b', 'pbkdf2-sha256$abc$a$b', 'pbkdf2-sha256$10$!!$!!']) {
    expect(await verifyPassword('x', bad), bad).toBe(false);
  }
});
