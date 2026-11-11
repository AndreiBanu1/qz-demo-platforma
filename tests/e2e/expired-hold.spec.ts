import { RESET_TOKEN } from '../support/reset-token';
import { expect, test } from '../support/fixtures';
import { logInViaForm, randomOpenDay } from '../support/ui';

test('an expired hold shows „Rezervare expirată”, offers no payment and is listed under past bookings', async ({ page, request, newClient }) => {
  const client = await newClient();
  const start = `${randomOpenDay()}T08:00:00.000Z`;
  const created = await client.request.post('/api/bookings', { data: { serviceId: 'tuns-dama', stylistId: 'stylist-iona', start } });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  await page.goto('/autentificare');
  await logInViaForm(page, client.email, client.password);
  await page.goto('/contul-meu');
  await expect(page.getByRole('link', { name: /^Plătește avansul/ })).toBeVisible(); // still payable while the hold runs

  const expired = await request.post(`/__demo/fixtures/expire-hold/${id}`, { headers: { 'X-Demo-Reset-Token': RESET_TOKEN } });
  expect(expired.status()).toBe(204);

  await page.reload();
  await expect(page.getByRole('link', { name: /^Plătește avansul/ })).toHaveCount(0);
  const past = page.getByRole('region', { name: 'Programări trecute, anulate sau expirate' });
  await expect(past.getByText(/Rezervare expirată/)).toBeVisible();

  await page.goto(`/avans/${id}`);
  await expect(page.getByText('Rezervarea a expirat. Alege din nou ora.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Plătește avansul de/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Alege din nou o oră' })).toHaveAttribute('href', '/programare');
});
