import { bookingAccessControl } from '../checks/bookingAccessControl';
import { test } from '../support/fixtures';

test("another client's booking is a 404", async ({ page, request, context }) => {
  await bookingAccessControl({ page, request, context });
});
