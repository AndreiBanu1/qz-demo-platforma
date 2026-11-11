// Usage: node scripts/reset-local.ts [target-url]
// Resets a LOCAL Worker (default http://127.0.0.1:8787) through POST /__demo/reset.
import { readFileSync } from 'node:fs';
import { assertLocalOnly, resolveTarget } from '../tests/support/hosts.ts';

const target = resolveTarget(process.argv[2]);
assertLocalOnly(target);

const vars = readFileSync('.dev.vars', 'utf8');
const token = /^DEMO_RESET_TOKEN=(.+)$/m.exec(vars)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!token) {
  console.error('DEMO_RESET_TOKEN is missing from .dev.vars');
  process.exit(1);
}

const res = await fetch(new URL('/__demo/reset', target), {
  method: 'POST',
  headers: { 'X-Demo-Reset-Token': token },
});
if (res.status !== 204) {
  console.error(`Reset failed: HTTP ${res.status}`);
  process.exit(1);
}
console.log(`Reset done on ${target.origin}`);
