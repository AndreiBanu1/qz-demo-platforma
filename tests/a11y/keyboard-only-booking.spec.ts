import { keyboardOnlyBooking } from '../checks/keyboardOnlyBooking';
import { test } from '../support/fixtures';

test('a booking can be made with the keyboard alone, with a visible focus on each control', async ({ page, request, context }) => {
  await keyboardOnlyBooking({ page, request, context });
});
