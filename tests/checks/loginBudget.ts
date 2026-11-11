import { expect } from '@playwright/test';
import { requestFor } from '../support/bugs';
import { createClient } from '../support/fixtures';
import { assertLocalOnly, resolveTarget } from '../support/hosts';
import type { CheckFixtures } from './types';

const BUDGET_MS = 1000;

/** Login answers within the budget, on success and on failure. Local targets only. */
export async function loginBudget({ context }: CheckFixtures): Promise<void> {
  const target = resolveTarget(process.env.TARGET);
  assertLocalOnly(target);
  const client = await createClient(target.href);
  const api = await requestFor(context);
  try {
    // One untimed login first, so a cold Worker does not count against the budget.
    await api.post('/api/auth/login', { data: { email: client.email, password: client.password } });
    for (const password of [client.password, 'gresita-total-1']) {
      const t0 = Date.now();
      const res = await api.post('/api/auth/login', { data: { email: client.email, password } });
      const took = Date.now() - t0;
      expect(res.status(), 'login status').toBe(password === client.password ? 200 : 401);
      expect(took, `[check:loginBudget] login took ${took} ms`).toBeLessThan(BUDGET_MS);
    }
  } finally {
    await api.dispose();
    await client.request.dispose();
  }
}
