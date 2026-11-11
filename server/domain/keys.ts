/** Refuses to run if any STRIPE* variable holds a live key. */
export function assertNoLiveKeys(env: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('STRIPE') && typeof value === 'string' && value.includes('_live_')) {
      throw new Error(`Refusing to run: ${key} looks like a live Stripe key`);
    }
  }
}
