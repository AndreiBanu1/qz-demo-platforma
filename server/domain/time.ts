const TZ = 'Europe/Bucharest';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});
const offsetFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'longOffset' });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function now(env: { DEMO_NOW?: string }): Date {
  if (env.DEMO_NOW) {
    const d = new Date(env.DEMO_NOW);
    if (Number.isNaN(d.getTime())) throw new Error('DEMO_NOW is not a valid date');
    return d;
  }
  return new Date();
}

export function localParts(d: Date): { date: string; minutes: number; weekday: number } {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(d)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

/** Offset of Europe/Bucharest from UTC at the given instant, in minutes. */
function offsetMinutes(d: Date): number {
  const name = offsetFmt.formatToParts(d).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(name);
  if (!m) throw new Error(`Unexpected offset: ${name}`);
  if (!m[1]) return 0;
  const total = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -total : total;
}

/** The UTC instant at which Bucharest wall clocks read `date` (YYYY-MM-DD) plus `minutes`. */
export function fromLocal(date: string, minutes: number): Date {
  const [y, mo, da] = date.split('-').map(Number);
  const asUtc = Date.UTC(y, mo - 1, da, 0, minutes);
  let guess = asUtc - offsetMinutes(new Date(asUtc)) * 60_000;
  // Re-check near a DST switch, where the first offset may be the wrong side.
  guess = asUtc - offsetMinutes(new Date(guess)) * 60_000;
  return new Date(guess);
}

/** The UTC bounds [from, to) of one Europe/Bucharest local day (YYYY-MM-DD). */
export function localDayWindow(date: string): { from: Date; to: Date } {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { from: fromLocal(date, 0), to: fromLocal(next, 0) };
}
