import { expect, test } from '../support/fixtures';
import { assertLocalOnly, isLocalTarget, resolveTarget } from '../support/hosts';

const BUDGET_MS = 500;
const DAY = '2027-02-01'; // a Monday with no bookings of its own

test('the slot list answers in under 500 ms', async ({ request, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'timing budgets are checked on a local target only');
  assertLocalOnly(resolveTarget(process.env.TARGET));
  const url = `/api/slots?serviceId=tuns-dama&date=${DAY}`;
  // One untimed request first, so a cold Worker and a cold database do not count against the budget.
  expect((await request.get(url)).status()).toBe(200);

  const t0 = Date.now();
  const res = await request.get(url);
  const took = Date.now() - t0;
  expect(res.status()).toBe(200);
  expect((await res.json()).slots.length, 'an open day offers times').toBeGreaterThan(0);
  expect(took, `slot list took ${took} ms`).toBeLessThan(BUDGET_MS);
});
