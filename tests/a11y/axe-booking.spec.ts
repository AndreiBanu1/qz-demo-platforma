import { axeBooking } from '../checks/axeBooking';
import { test } from '../support/fixtures';

test('axe finds no violations on the home, booking, login and sign-up pages', async ({ page, request, context }) => {
  await axeBooking({ page, request, context });
});
