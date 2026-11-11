import { expect, type Locator, type Page } from '@playwright/test';
import { createClient } from '../support/fixtures';
import { resolveTarget } from '../support/hosts';
import { randomAprilStart, type CheckFixtures } from './types';

/** The focused element must show a focus indicator: the app styles it as an outline (web/src/index.css). */
async function expectVisibleFocus(page: Page): Promise<void> {
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    // The browser's own calendar button inside a date field is focused through the field and cannot be styled.
    if (el instanceof HTMLInputElement && el.type === 'date' && !el.matches(':focus-visible')) return null;
    const s = getComputedStyle(el);
    const name = `${el.tagName.toLowerCase()}${el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : ''}`;
    return { name, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
  });
  if (!focus) return;
  expect(focus.outlineStyle, `[check:keyboardOnlyBooking] no focus outline on ${focus.name}`).not.toBe('none');
  expect(focus.outlineWidth, `[check:keyboardOnlyBooking] zero-width focus outline on ${focus.name}`).not.toBe('0px');
}

/** Presses Tab until `target` has focus, checking the focus indicator on every control passed on the way. */
async function tabTo(page: Page, target: Locator, what: string): Promise<void> {
  expect(await target.count(), `[check:keyboardOnlyBooking] ${what} is not on the page`).toBeGreaterThan(0);
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    await expectVisibleFocus(page);
    if (await target.first().evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`[check:keyboardOnlyBooking] ${what} cannot be reached with the Tab key`);
}

/**
 * Books a time using only Tab, Shift+Tab, Enter and Space (no clicks) and checks the focus indicator on each
 * control. The day comes from the URL: typing digits into a date field is not one of the allowed keys.
 */
export async function keyboardOnlyBooking({ page, context }: CheckFixtures): Promise<void> {
  const baseURL = resolveTarget(process.env.TARGET);
  const client = await createClient(baseURL.href);
  try {
    const sessionValue = client.cookie.slice(client.cookie.indexOf('=') + 1);
    await context.addCookies([{ name: 'qz_session', value: sessionValue, url: baseURL.origin }]);

    await page.goto(`/programare?d=${randomAprilStart().slice(0, 10)}`);
    await expect(page.getByRole('heading', { name: 'Programare', level: 1 })).toBeVisible();

    const service = page.locator('input[name="service"]').first();
    await expect(service).toBeVisible();
    await tabTo(page, service, 'the first service');
    await page.keyboard.press('Space');
    await expect(service).toBeChecked();

    const stylist = page.locator('input[name="stylist"]').first();
    await expect(stylist).toBeVisible();
    await tabTo(page, stylist, 'the first stylist');
    await page.keyboard.press('Space');
    await expect(stylist).toBeChecked();

    // Forward into the date field and back again with Shift+Tab.
    await page.keyboard.press('Tab');
    await expectVisibleFocus(page);
    await page.keyboard.press('Shift+Tab');
    await expectVisibleFocus(page);
    expect(await stylist.evaluate((el) => el === document.activeElement), '[check:keyboardOnlyBooking] Shift+Tab returns to the stylist').toBe(true);

    const hours = page.getByRole('group', { name: 'Ore libere' });
    await expect(hours).toBeVisible();
    const firstHour = hours.getByRole('button').first();
    await tabTo(page, firstHour, 'the first free time');
    await page.keyboard.press('Space');
    await expect(page.getByRole('heading', { name: 'Rezumat' })).toBeVisible();

    const confirm = page.getByRole('button', { name: 'Confirmă și treci la avans' });
    await tabTo(page, confirm, 'the confirm button');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Plătește avansul' })).toBeVisible();
  } finally {
    await client.request.dispose();
  }
}
