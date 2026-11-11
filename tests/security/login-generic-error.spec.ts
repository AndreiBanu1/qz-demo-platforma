import { loginGenericError } from '../checks/loginGenericError';
import { test } from '../support/fixtures';

test('an unknown email and a wrong password both get „Email sau parolă greșite”', async ({ page, request, context }) => {
  await loginGenericError({ page, request, context });
});
