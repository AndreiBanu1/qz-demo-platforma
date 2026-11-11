import { fromLocal, localParts } from './time';

export const OPEN_MIN = 540;
export const CLOSE_MIN = 1140;
export const STEP_MIN = 15;

export type Busy = { stylistId: string; start: Date; end: Date };
export type Slot = { stylistId: string; start: string };

/** Start is on an open day (Mon-Sat), not before opening, before closing and, if checkEnd, the service ends by closing. */
export function fitsInDay(start: Date, durationMin: number, checkEnd: boolean): boolean {
  const { weekday, minutes } = localParts(start);
  if (weekday === 0) return false;
  if (minutes < OPEN_MIN || minutes >= CLOSE_MIN) return false;
  if (checkEnd && minutes + durationMin > CLOSE_MIN) return false;
  return true;
}

export function computeSlots(a: {
  date: string;
  durationMin: number;
  stylistIds: string[];
  busy: Busy[];
  now: Date;
  checkEnd: boolean;
}): Slot[] {
  const out: Slot[] = [];
  for (let m = OPEN_MIN; m < CLOSE_MIN; m += STEP_MIN) {
    const start = fromLocal(a.date, m);
    if (localParts(start).date !== a.date) continue;
    if (start.getTime() < a.now.getTime()) continue;
    if (!fitsInDay(start, a.durationMin, a.checkEnd)) continue;
    const end = start.getTime() + a.durationMin * 60_000;
    for (const stylistId of a.stylistIds) {
      const clash = a.busy.some(
        (b) => b.stylistId === stylistId && b.start.getTime() < end && b.end.getTime() > start.getTime(),
      );
      if (!clash) out.push({ stylistId, start: start.toISOString() });
    }
  }
  return out.sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : x.stylistId < y.stylistId ? -1 : x.stylistId > y.stylistId ? 1 : 0));
}
