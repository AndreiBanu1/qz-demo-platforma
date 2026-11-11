/** The planted bugs. Every one is documented in docs/bugs.md and found by `grep -r "BUG:"`. */
export const BUG_IDS = [
  'slow-login',
  'login-enumeration',
  'booking-past-closing',
  'a11y-gap',
  'leaky-errors',
  'idor-booking',
] as const;

export type BugId = (typeof BUG_IDS)[number];

/** Strip labels shown under the banner while a bug is on. */
export const BUG_LABELS: Record<BugId, string> = {
  'slow-login': 'login lent',
  'login-enumeration': 'mesaje de login prea clare',
  'booking-past-closing': 'programare după închidere',
  'a11y-gap': 'accesibilitate stricată',
  'leaky-errors': 'erori cu detalii interne',
  'idor-booking': 'acces la programările altora',
};

export const BUGS_COOKIE = 'qz_bugs';

/** `all` → every id, `off` → none; unknown ids are dropped and repeats removed. Order follows BUG_IDS. */
export function parseBugs(raw: string): BugId[] {
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.includes('all')) return [...BUG_IDS];
  const wanted = new Set(parts);
  return BUG_IDS.filter((id) => wanted.has(id));
}
