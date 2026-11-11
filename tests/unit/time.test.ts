import { describe, expect, it } from 'vitest';
import { fromLocal, localParts, now } from '../../server/domain/time';

describe('time', () => {
  it('uses DEMO_NOW when set', () => {
    expect(now({ DEMO_NOW: '2026-12-07T08:00:00.000Z' }).toISOString()).toBe('2026-12-07T08:00:00.000Z');
  });
  it('falls back to the real clock', () => {
    const before = Date.now();
    const t = now({}).getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });
  it('splits a UTC instant into Bucharest local parts', () => {
    expect(localParts(new Date('2026-12-07T08:00:00Z'))).toEqual({ date: '2026-12-07', minutes: 600, weekday: 1 });
  });
  it('rolls the local date over after midnight local time', () => {
    expect(localParts(new Date('2026-12-06T22:30:00Z'))).toEqual({ date: '2026-12-07', minutes: 30, weekday: 1 });
  });
  it('converts local time to UTC across DST', () => {
    expect(fromLocal('2027-03-27', 540).toISOString()).toBe('2027-03-27T07:00:00.000Z');
    expect(fromLocal('2027-03-29', 540).toISOString()).toBe('2027-03-29T06:00:00.000Z');
    expect(fromLocal('2026-10-26', 540).toISOString()).toBe('2026-10-26T07:00:00.000Z');
  });
});
