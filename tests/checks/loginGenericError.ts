import { expect } from '@playwright/test';
import { requestFor } from '../support/bugs';
import type { CheckFixtures } from './types';

const GENERIC = 'Email sau parolă greșite';

/** An unknown email and a wrong password get the same, exact message. */
export async function loginGenericError({ context }: CheckFixtures): Promise<void> {
  const api = await requestFor(context);
  try {
    const unknown = await api.post('/api/auth/login', {
      data: { email: `nimeni-${crypto.randomUUID()}@exemplu.test`, password: 'parola-de-test-1' },
    });
    const wrong = await api.post('/api/auth/login', {
      data: { email: 'ana@bucla-verde.test', password: 'gresita-total-1' },
    });
    expect(unknown.status(), 'unknown email status').toBe(401);
    expect(wrong.status(), 'wrong password status').toBe(401);
    expect((await unknown.json()).error.message, '[check:loginGenericError] message for an unknown email').toBe(GENERIC);
    expect((await wrong.json()).error.message, '[check:loginGenericError] message for a wrong password').toBe(GENERIC);
  } finally {
    await api.dispose();
  }
}
