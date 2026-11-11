import { fitsBeforeClosing } from '../checks/fitsBeforeClosing';
import { test } from '../support/fixtures';

test('the last time offered for Vopsit complet on 2026-12-28 is 17:00', async ({ page, request, context }) => {
  await fitsBeforeClosing({ page, request, context });
});
