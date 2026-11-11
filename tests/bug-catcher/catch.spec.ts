import { axeBooking } from '../checks/axeBooking';
import { bookingAccessControl } from '../checks/bookingAccessControl';
import { fitsBeforeClosing } from '../checks/fitsBeforeClosing';
import { loginBudget } from '../checks/loginBudget';
import { loginGenericError } from '../checks/loginGenericError';
import { noInternalDetails } from '../checks/noInternalDetails';
import { isLocalHost, type CheckFixtures } from '../checks/types';
import type { BugId } from '../../server/bugs/registry';
import { enableBugsInBrowser } from '../support/bugs';
import { test } from '../support/fixtures';
import { CHECK_FOR } from './pairs';

/**
 * Each test turns on exactly one planted bug and reruns the clean suite's check for it. The check must fail,
 * which is what `test.fail()` expects: if the check ever passes, this test fails and the bug went uncaught.
 */
const CHECKS: Record<string, (f: CheckFixtures) => Promise<void>> = {
  loginBudget,
  loginGenericError,
  fitsBeforeClosing,
  axeBooking,
  noInternalDetails,
  bookingAccessControl,
};

for (const [id, name] of Object.entries(CHECK_FOR) as [BugId, string][]) {
  const check = CHECKS[name];
  test(`catches ${id}`, async ({ page, request, context, baseURL }) => {
    test.skip(id === 'slow-login' && !isLocalHost(baseURL), 'timing budgets are checked on a local target only');
    await enableBugsInBrowser(context, [id]); // setup errors are ordinary failures: test.fail() comes after it
    test.fail();
    await check({ page, request, context });
  });
}
