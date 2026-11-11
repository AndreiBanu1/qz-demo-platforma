import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

/** What every catching check receives. The context may already carry the `qz_bugs` cookie (bug-catcher). */
export type CheckFixtures = { page: Page; request: APIRequestContext; context: BrowserContext };

/** Local-only checks (load, brute force) never run against a public host. */
export const isLocalHost = (baseURL: string | undefined): boolean =>
  !!baseURL && ['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname);

/**
 * A random bookable start in April 2027 (no other spec books there; UTC+3 in summer, so 07:00Z is 10:00 local),
 * Monday to Saturday, on the hour. Specs run in parallel on one database, so the day and hour are random.
 */
export function randomAprilStart(): string {
  let day: number;
  do day = 5 + Math.floor(Math.random() * 26);
  while ([11, 18, 25].includes(day)); // Sundays
  const hour = 7 + Math.floor(Math.random() * 8);
  return `2027-04-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}
