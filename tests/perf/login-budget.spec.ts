import { loginBudget } from '../checks/loginBudget';
import { isLocalTarget } from '../support/hosts';
import { test } from '../support/fixtures';

test('login answers in under 1000 ms', async ({ page, request, context, baseURL }) => {
  test.skip(!isLocalTarget(baseURL), 'timing budgets are checked on a local target only');
  await loginBudget({ page, request, context });
});
