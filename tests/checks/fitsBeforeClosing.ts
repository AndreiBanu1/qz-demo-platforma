import { expect } from '@playwright/test';
import { chooseBooking } from '../support/ui';
import type { CheckFixtures } from './types';

/** In the booking UI, the last start offered for Vopsit complet (120 min) on a Monday is 17:00, so it ends by 19:00. */
export async function fitsBeforeClosing({ page }: CheckFixtures): Promise<void> {
  await page.goto('/programare');
  await chooseBooking(page, { service: 'Vopsit complet', stylist: 'Oricine', day: '2026-12-28' });
  const times = await page.getByRole('group', { name: 'Ore libere' }).getByRole('button').allTextContents();
  expect(times.length, 'no times offered').toBeGreaterThan(0);
  expect(times.at(-1), '[check:fitsBeforeClosing] last time offered for Vopsit complet').toBe('17:00');
}
