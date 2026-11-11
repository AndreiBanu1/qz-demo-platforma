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

/**
 * Each test turns on exactly one planted bug and reruns the clean suite's check for it. The check must fail,
 * which is what `test.fail()` expects: if the check ever passes, this test fails and the bug went uncaught.
 */
const PAIRS: [BugId, (f: CheckFixtures) => Promise<void>][] = [
  ['slow-login', loginBudget],
  ['login-enumeration', loginGenericError],
  ['booking-past-closing', fitsBeforeClosing],
  ['a11y-gap', axeBooking],
  ['leaky-errors', noInternalDetails],
  ['idor-booking', bookingAccessControl],
];

for (const [id, check] of PAIRS) {
  test(`catches ${id}`, async ({ page, request, context, baseURL }) => {
    test.skip(id === 'slow-login' && !isLocalHost(baseURL), 'timing budgets are checked on a local target only');
    test.fail();
    await enableBugsInBrowser(context, [id]);
    await check({ page, request, context });
  });
}
