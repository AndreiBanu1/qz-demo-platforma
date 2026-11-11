import { requestFor } from '../support/bugs';
import { test, expect } from '../support/fixtures';
import { assertLocalOnly, isLocalTarget, resolveTarget } from '../support/hosts';

test('the 6th failed login for one email is a 429 with the cool-down message', async ({ context, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'brute-force style tests run on a local target only');
  assertLocalOnly(resolveTarget(process.env.TARGET));
  const email = `nimeni-${crypto.randomUUID()}@exemplu.test`;
  const api = await requestFor(context); // one fixed random CF-Connecting-IP for the whole test
  try {
    for (let i = 1; i <= 5; i++) {
      const res = await api.post('/api/auth/login', { data: { email, password: 'gresita-total-1' } });
      expect(res.status(), `failure ${i}`).toBe(401);
    }
    const blocked = await api.post('/api/auth/login', { data: { email, password: 'gresita-total-1' } });
    expect(blocked.status()).toBe(429);
    expect((await blocked.json()).error).toEqual({
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Prea multe încercări. Încearcă din nou în 15 minute.',
    });
  } finally {
    await api.dispose();
  }
});
