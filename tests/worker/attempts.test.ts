import { env } from 'cloudflare:test';
import { expect, test } from 'vitest';
import { clearAttempts, countFailures, recordFailure } from '../../server/db/attempts';

const now = new Date('2026-12-07T08:00:00.000Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

test('countFailures counts per email and per ip inside the window only', async () => {
  await clearAttempts(env.DB);
  await recordFailure(env.DB, 'a@x.test', '1.1.1.1', minutesAgo(1));
  await recordFailure(env.DB, 'a@x.test', '2.2.2.2', minutesAgo(10));
  await recordFailure(env.DB, 'a@x.test', '1.1.1.1', minutesAgo(20)); // outside the 15 minute window
  await recordFailure(env.DB, 'b@x.test', '1.1.1.1', minutesAgo(2));
  const since = minutesAgo(15);
  expect(await countFailures(env.DB, { email: 'a@x.test' }, since)).toBe(2);
  expect(await countFailures(env.DB, { email: 'b@x.test' }, since)).toBe(1);
  expect(await countFailures(env.DB, { ip: '1.1.1.1' }, since)).toBe(2);
  expect(await countFailures(env.DB, { ip: '3.3.3.3' }, since)).toBe(0);
});

test('clearAttempts removes everything', async () => {
  await recordFailure(env.DB, 'c@x.test', '9.9.9.9', now);
  await clearAttempts(env.DB);
  expect(await countFailures(env.DB, { email: 'c@x.test' }, minutesAgo(15))).toBe(0);
});
