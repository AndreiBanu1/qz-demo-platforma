import { describe, expect, it } from 'vitest';
import { computeSlots, fitsInDay, CLOSE_MIN, OPEN_MIN, STEP_MIN, type Busy } from '../../server/domain/slots';
import { fromLocal } from '../../server/domain/time';

const nowEarly = new Date('2026-12-01T00:00:00Z');
const same = { date: '2026-12-14', durationMin: 120, stylistIds: ['st1'], busy: [] as Busy[], now: nowEarly, checkEnd: true };

describe('slots', () => {
  it('exposes the opening constants', () => {
    expect([OPEN_MIN, CLOSE_MIN, STEP_MIN]).toEqual([540, 1140, 15]);
  });
  it('offers 09:00 to 17:00 for a 120 min service when the end is checked', () => {
    const s = computeSlots(same);
    expect(s.at(0)!.start).toBe(fromLocal('2026-12-14', 540).toISOString());
    expect(s.at(-1)!.start).toBe(fromLocal('2026-12-14', 1020).toISOString());
  });
  it('bug mode (checkEnd false) offers starts up to 18:45', () => {
    expect(computeSlots({ ...same, checkEnd: false }).at(-1)!.start).toBe(fromLocal('2026-12-14', 1125).toISOString());
  });
  it('offers nothing on Sunday', () => {
    expect(computeSlots({ ...same, date: '2026-12-13' })).toEqual([]);
  });
  it('offers Saturday', () => {
    expect(computeSlots({ ...same, date: '2026-12-12' }).length).toBeGreaterThan(0);
  });
  it('removes slots overlapping a busy interval for that stylist only', () => {
    const busy: Busy[] = [{ stylistId: 'st1', start: fromLocal('2026-12-14', 600), end: fromLocal('2026-12-14', 660) }];
    const starts = computeSlots({ ...same, durationMin: 60, busy, stylistIds: ['st1', 'st2'] })
      .filter((s) => s.stylistId === 'st1')
      .map((s) => s.start);
    const has = (m: number) => starts.includes(fromLocal('2026-12-14', m).toISOString());
    expect(has(540)).toBe(true);
    for (let m = 555; m <= 645; m += 15) expect(has(m)).toBe(false);
    expect(has(660)).toBe(true);
    const st2 = computeSlots({ ...same, durationMin: 60, busy, stylistIds: ['st1', 'st2'] }).filter((s) => s.stylistId === 'st2');
    expect(st2.some((s) => s.start === fromLocal('2026-12-14', 600).toISOString())).toBe(true);
  });
  it('does not offer slots before now', () => {
    const now = new Date(fromLocal('2026-12-14', 607)); // 10:07 local
    expect(computeSlots({ ...same, now, durationMin: 30 }).at(0)!.start).toBe(fromLocal('2026-12-14', 615).toISOString());
  });
  it('sorts by start then stylistId', () => {
    const s = computeSlots({ ...same, durationMin: 30, stylistIds: ['b', 'a'] });
    expect(s.slice(0, 2).map((x) => x.stylistId)).toEqual(['a', 'b']);
    expect(s[0].start).toBe(s[1].start);
  });
  it('fitsInDay checks end only when asked', () => {
    const late = fromLocal('2026-12-14', 1125);
    expect(fitsInDay(late, 120, true)).toBe(false);
    expect(fitsInDay(late, 120, false)).toBe(true);
    expect(fitsInDay(fromLocal('2026-12-14', 1140), 15, false)).toBe(false);
    expect(fitsInDay(fromLocal('2026-12-14', 525), 15, false)).toBe(false);
    expect(fitsInDay(fromLocal('2026-12-13', 600), 15, true)).toBe(false);
    expect(fitsInDay(fromLocal('2026-12-14', 1020), 120, true)).toBe(true);
  });
});
