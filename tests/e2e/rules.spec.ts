import { DEMO_ACCOUNTS } from '../../shared/demo-accounts';
import { expect, test } from '../support/fixtures';

const PATHS = ['/', '/programare', '/autentificare', '/cont-nou', '/contul-meu', '/admin', '/nu-exista'];

for (const path of PATHS) {
  test(`banner, footer and noindex on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText('Site demonstrativ realizat de Quality Zone', { exact: true })).toBeVisible();
    await expect(page.getByText('Salon fictiv: nu are adresă sau telefon', { exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
}

test('login page prints the public demo accounts', async ({ page }) => {
  await page.goto('/autentificare');
  for (const a of DEMO_ACCOUNTS) {
    await expect(page.getByText(a.email, { exact: true })).toBeVisible();
    await expect(page.getByText(a.password, { exact: true })).toBeVisible();
  }
});

test('?bugs=slow-login shows „Mod cu buguri activ: login lent” and the URL loses ?bugs', async ({ page }) => {
  await page.goto('/autentificare?bugs=slow-login');
  await expect(page.getByText('Mod cu buguri activ: login lent', { exact: true })).toBeVisible();
  expect(page.url()).not.toContain('bugs');
  expect(new URL(page.url()).pathname).toBe('/autentificare');
});

test('no bug strip without ?bugs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salon fictiv: nu are adresă sau telefon')).toBeVisible();
  await expect(page.getByText(/Mod cu buguri activ/)).toHaveCount(0);
});

test('sign-up form shows the reserved-email hint', async ({ page }) => {
  await page.goto('/cont-nou');
  await expect(page.getByText('Folosește o adresă inventată, de exemplu ana@exemplu.test')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAccessibleDescription(/ana@exemplu\.test/);
});

test('a11y-gap turns the time slots into plain divs and drops the labels (clean mode has buttons)', async ({ page }) => {
  await page.goto('/programare?bugs=a11y-gap');
  await expect(page.getByText('Mod cu buguri activ: accesibilitate stricată', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(10); // 6 services + 3 stylists + Oricine: they exist but have no accessible name
  await expect(page.getByRole('radio', { name: /Tuns bărbați/ })).toHaveCount(0);
  await page.locator('input[name="service"]').nth(1).check();
  await page.locator('input[name="stylist"]').last().check();
  await page.locator('input[type="date"]').fill('2028-04-04');
  await expect(page.getByText('10:00', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toHaveCount(0);
});

test('?bugs= stays out of the URL after the router moves (choosing a service)', async ({ page }) => {
  await page.goto('/programare?bugs=booking-past-closing');
  await expect(page.getByText('Mod cu buguri activ: programare după închidere', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Vezi lista bugurilor/ })).toHaveAttribute('href', /docs\/bugs\.md$/);
  await page.getByRole('radio', { name: /^Tuns bărbați/ }).check();
  await expect(page).toHaveURL(/[?&]s=tuns-barbati/);
  expect(page.url()).not.toContain('bugs');
});
