// Usage: node scripts/bug-summary.ts [report/bug-catcher.json]
// Reads a Playwright JSON report (the bug-catcher project alone, or a full run) and writes report/bugs-caught.json,
// a shields-style endpoint badge: "<caught>/<total>". Only the bug-catcher tests count (titles `catches <id>`), and the
// total is the number of planted bugs. A bug counts as caught only when its test was an expected failure AND its first
// error message carries the `[check:<name>]` marker of the check paired with that bug (so setup errors and timeouts
// do not count as caught). Exits 1 when any bug was missed, so CI turns red.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CHECK_FOR } from '../tests/bug-catcher/pairs.ts';
import { BUG_IDS } from '../server/bugs/registry.ts';

type Test = { expectedStatus: string; status: string; results?: { error?: { message?: string } }[] };
type Spec = { title: string; tests: Test[] };
type Suite = { specs?: Spec[]; suites?: Suite[] };

const input = process.argv[2] ?? 'report/bug-catcher.json';
const report: { suites: Suite[] } = JSON.parse(readFileSync(input, 'utf8'));

const specs: Spec[] = [];
const walk = (suite: Suite) => {
  specs.push(...(suite.specs ?? []));
  (suite.suites ?? []).forEach(walk);
};
report.suites.forEach(walk);

const verdicts = BUG_IDS.map((id) => {
  const spec = specs.find((s) => s.title === `catches ${id}`);
  if (!spec) return { title: `catches ${id}`, caught: false, why: ' (no such test in the report)' };
  const t = spec.tests[0];
  const marker = `[check:${CHECK_FOR[id]}]`;
  const message = (t.results?.[0]?.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  const expectedFailure = t.expectedStatus === 'failed' && t.status === 'expected';
  const caught = expectedFailure && message.includes(marker);
  const why = caught ? '' : expectedFailure ? ` (failed without ${marker}: ${message.split('\n')[0]})` : ` (${t.status}, not an expected failure: ${message.split('\n')[0]})`;
  return { title: spec.title, caught, why };
});
const caught = verdicts.filter((v) => v.caught).length;
const total = BUG_IDS.length;

const out = {
  schemaVersion: 1,
  label: 'planted bugs caught',
  message: `${caught}/${total}`,
  color: caught === total ? 'brightgreen' : 'red',
};
mkdirSync('report', { recursive: true });
writeFileSync('report/bugs-caught.json', `${JSON.stringify(out, null, 2)}\n`);
for (const v of verdicts) console.log(`${v.caught ? 'caught  ' : 'MISSED  '}${v.title}${v.why}`);
console.log(`${out.label}: ${out.message}`);
if (caught < total) process.exit(1);
