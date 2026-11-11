import { expect, test } from 'vitest';
import { assertLocalOnly, resolveTarget } from '../support/hosts';

test('defaults to the local copy', () => expect(resolveTarget().href).toBe('http://127.0.0.1:8787/'));
test('refuses a host outside the allowlist', () =>
  expect(() => resolveTarget('https://example.org')).toThrow('Target host not allowed: example.org'));
test('assertLocalOnly refuses any non-local host, even an allowed public one', () =>
  expect(() => assertLocalOnly(new URL('https://bucla-verde-demo.x.workers.dev'))).toThrow());
