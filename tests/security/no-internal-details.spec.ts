import { noInternalDetails } from '../checks/noInternalDetails';
import { test } from '../support/fixtures';

test('a malformed start is a 400 with no SQL, stack trace or file names', async ({ page, request, context }) => {
  await noInternalDetails({ page, request, context });
});
