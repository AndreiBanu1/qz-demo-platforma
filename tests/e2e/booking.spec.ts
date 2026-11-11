import { expect, test } from '../support/fixtures';
import { chooseBooking, logInViaForm, payWithCard, randomOpenDay } from '../support/ui';

test('full booking: sign-up → book → pay 4242 → confirmation → cancel', async ({ page }) => {
  let loads = 0;
  page.on('load', () => loads++); // a full page load; SPA navigation fires none
  const email = `user-${crypto.randomUUID()}@exemplu.test`;

  await page.goto('/cont-nou');
  await page.getByLabel('Nume').fill('Client Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Parolă').fill('parola-de-test-1');
  await page.getByRole('button', { name: 'Creează contul' }).click();

  await expect(page.getByRole('heading', { name: 'Programare', level: 1 })).toBeVisible();
  await chooseBooking(page, { service: 'Tuns bărbați', stylist: 'Oricine', day: randomOpenDay() });
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rezumat' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmă și treci la avans' }).click();

  await expect(page.getByRole('heading', { name: 'Plătește avansul' })).toBeVisible();
  await expect(page.getByText('Avans').first()).toBeVisible();
  await payWithCard(page, '4242 4242 4242 4242');

  await expect(page.getByRole('heading', { name: 'Programarea ta este confirmată' })).toBeVisible();
  await page.getByRole('button', { name: 'Anulează programarea' }).click();
  await expect(page.getByRole('heading', { name: 'Programarea a fost anulată' })).toBeVisible();
  await expect(page.getByText('Avansul a fost rambursat (mod test).')).toBeVisible();

  expect(loads).toBeLessThanOrEqual(2);
});

test('declined card shows „Cardul a fost refuzat. Încearcă alt card de test.”', async ({ page, newClient }) => {
  const client = await newClient();
  await page.goto('/autentificare');
  await logInViaForm(page, client.email, client.password);
  await expect(page.getByRole('link', { name: 'Contul meu' })).toBeVisible();

  await page.getByRole('link', { name: 'Programare' }).click();
  await chooseBooking(page, { service: 'Tuns bărbați', stylist: 'Oricine', day: randomOpenDay() });
  await page.getByRole('button', { name: '11:00', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmă și treci la avans' }).click();

  await payWithCard(page, '4000 0000 0000 0002');
  await expect(page.getByRole('alert')).toHaveText('Cardul a fost refuzat. Încearcă alt card de test.');
  await expect(page.getByRole('heading', { name: 'Plătește avansul' })).toBeVisible();

  await payWithCard(page, '4242 4242 4242 4242');
  await expect(page.getByRole('heading', { name: 'Programarea ta este confirmată' })).toBeVisible();
});

test('admin blocks a slot and it disappears from the booking page', async ({ page }) => {
  const day = randomOpenDay();
  await page.goto('/autentificare');
  await logInViaForm(page, 'admin@bucla-verde.test', 'Frunza-Admin-2026');
  await page.getByRole('link', { name: 'Programare' }).click();

  await chooseBooking(page, { service: 'Tuns bărbați', stylist: 'Lucian', day });
  const ten = page.getByRole('button', { name: '10:00', exact: true });
  await expect(ten).toBeVisible();

  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByLabel('Ziua').fill(day);
  await page.getByLabel('Stilist').selectOption({ label: 'Lucian' });
  await page.getByLabel('De la').selectOption({ label: '10:00' });
  await page.getByLabel('Până la').selectOption({ label: '10:30' });
  await page.getByRole('button', { name: 'Blochează intervalul' }).click();
  await expect(page.getByText('Interval blocat: 10:00–10:30.')).toBeVisible();

  await page.getByRole('link', { name: 'Programare' }).click();
  await chooseBooking(page, { service: 'Tuns bărbați', stylist: 'Lucian', day });
  await expect(page.getByRole('button', { name: '09:30', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toHaveCount(0);
});
