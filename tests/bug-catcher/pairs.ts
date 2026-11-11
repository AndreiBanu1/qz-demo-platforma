import type { BugId } from '../../server/bugs/registry.ts';

/**
 * Which check catches which planted bug. Shared by catch.spec.ts (which runs the checks) and
 * scripts/bug-summary.ts (which verifies the failure carries `[check:<name>]`), so the pairing lives in one place.
 * Plain data and a type import only: Node runs bug-summary without a bundler.
 */
export const CHECK_FOR: Record<BugId, string> = {
  'slow-login': 'loginBudget',
  'login-enumeration': 'loginGenericError',
  'booking-past-closing': 'fitsBeforeClosing',
  'a11y-gap': 'axeBooking',
  'leaky-errors': 'noInternalDetails',
  'idor-booking': 'bookingAccessControl',
};
