import { loginBudget } from '../checks/loginBudget';
import { isLocalHost } from '../checks/types';
import { test } from '../support/fixtures';

test('login answers in under 1000 ms', async ({ page, request, context, baseURL }) => {
  test.skip(!isLocalHost(baseURL), 'timing budgets are checked on a local target only');
  await loginBudget({ page, request, context });
});
