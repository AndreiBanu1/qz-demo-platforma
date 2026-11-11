import { expect, test } from 'vitest';
import { isReservedEmail, normalizeEmail } from '../../server/auth/email';

test('normalizeEmail trims and lowercases', () => {
  expect(normalizeEmail(' Ana@Bucla-Verde.TEST ')).toBe('ana@bucla-verde.test');
});

test('only .test and @example.com addresses are reserved', () => {
  expect(isReservedEmail('Ana@Exemplu.TEST')).toBe(true);
  expect(isReservedEmail('x@example.com')).toBe(true);
  expect(isReservedEmail('  X@EXAMPLE.COM ')).toBe(true);
  expect(isReservedEmail('x@gmail.com')).toBe(false);
  expect(isReservedEmail('x@test.com')).toBe(false);
  expect(isReservedEmail('x@sub.example.com')).toBe(false);
});
