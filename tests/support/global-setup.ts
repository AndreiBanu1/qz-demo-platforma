import { assertLocalOnly, resolveTarget } from './hosts';
import { RESET_TOKEN } from './reset-token';

/**
 * Resets the demo database once, before any spec runs (ruling R6: never mid-suite).
 * Only a local target gets the local token; a public target is left untouched.
 */
export default async function globalSetup(): Promise<void> {
  const target = resolveTarget(process.env.TARGET);
  try {
    assertLocalOnly(target);
  } catch {
    return;
  }
  // Plain fetch, no Origin: the reset route is token-protected and exempt from the Origin check.
  const res = await fetch(new URL('/__demo/reset', target), {
    method: 'POST',
    headers: { 'X-Demo-Reset-Token': RESET_TOKEN },
  });
  if (res.status !== 204) throw new Error(`global reset failed: expected 204, got ${res.status}`);
}
