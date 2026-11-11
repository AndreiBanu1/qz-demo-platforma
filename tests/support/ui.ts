import { expect, type Page } from '@playwright/test';

/**
 * A random open day (Monday to Saturday) in 2028 to 2030. Specs run in parallel on one database and the API specs
 * use 2027, so a random far-away day keeps browser specs from fighting over the same slots.
 */
export function randomOpenDay(): string {
  const week = Math.floor(Math.random() * 150);
  const day = Math.floor(Math.random() * 6);
  return new Date(Date.UTC(2028, 0, 3 + week * 7 + day)).toISOString().slice(0, 10); // 2028-01-03 is a Monday
}

export async function logInViaForm(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Parolă').fill(password);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
}

/** Picks service, stylist and day on the booking page. `stylist` is a name or „Oricine”. */
export async function chooseBooking(page: Page, opts: { service: string; stylist: string; day: string }): Promise<void> {
  await page.getByRole('radio', { name: new RegExp(`^${opts.service}`) }).check();
  await page.getByRole('radio', { name: opts.stylist }).check();
  await page.getByLabel('Data programării').fill(opts.day);
  await expect(page.getByRole('group', { name: 'Ore libere' })).toBeVisible();
}

export async function payWithCard(page: Page, number: string): Promise<void> {
  await page.getByLabel('Număr card de test').fill(number);
  await page.getByLabel(/^Expiră/).fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: /^Plătește avansul de/ }).click();
}
