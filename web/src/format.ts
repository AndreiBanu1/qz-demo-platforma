import { localParts } from '../../server/domain/time';

const TZ = 'Europe/Bucharest';
const dayFmt = new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** 14:30, in Europe/Bucharest. */
export function hhmm(iso: string): string {
  const m = localParts(new Date(iso)).minutes;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const minutesLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** „luni, 7 decembrie 2026”, in Europe/Bucharest. */
export const longDay = (iso: string): string => dayFmt.format(new Date(iso));

export const lei = (n: number) => `${n} lei`;

/** Today's date as YYYY-MM-DD in Europe/Bucharest. */
export const todayLocal = (): string => localParts(new Date()).date;
