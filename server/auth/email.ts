/** Trims and lowercases, so " Ana@Bucla-Verde.TEST " and "ana@bucla-verde.test" are one address. */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** Sign-up accepts only invented addresses: `.test` domains or `@example.com`. */
export function isReservedEmail(s: string): boolean {
  const e = normalizeEmail(s);
  return e.endsWith('.test') || e.endsWith('@example.com');
}
