import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import type { CheckFixtures } from './types';

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const summary = violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

/** Zero axe violations on the home page, the booking page after choosing a service, and both account forms. */
export async function axeBooking({ page }: CheckFixtures): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoViolations(page, '/');

  await page.goto('/programare');
  await expect(page.locator('input[name="service"]').first()).toBeVisible();
  await page.locator('input[name="service"]').first().check(); // by name, not role: with labels gone there is no accessible name
  await expectNoViolations(page, '/programare');

  await page.goto('/autentificare');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoViolations(page, '/autentificare');

  await page.goto('/cont-nou');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoViolations(page, '/cont-nou');
}
