// Usage: node scripts/bug-summary.ts [report/bug-catcher.json]
// Reads the Playwright JSON report of the bug-catcher project and writes report/bugs-caught.json, a shields-style
// endpoint badge: "<caught>/<total>". A bug counts as caught when its test was an expected failure that did fail.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

type Test = { expectedStatus: string; status: string };
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

const tests = specs.flatMap((s) => s.tests);
const caught = tests.filter((t) => t.expectedStatus === 'failed' && t.status === 'expected').length;
const total = tests.length;

const out = {
  schemaVersion: 1,
  label: 'planted bugs caught',
  message: `${caught}/${total}`,
  color: total > 0 && caught === total ? 'brightgreen' : 'red',
};
mkdirSync('report', { recursive: true });
writeFileSync('report/bugs-caught.json', `${JSON.stringify(out, null, 2)}\n`);
for (const s of specs) {
  const t = s.tests[0];
  console.log(`${t.expectedStatus === 'failed' && t.status === 'expected' ? 'caught  ' : 'MISSED  '}${s.title}`);
}
console.log(`${out.label}: ${out.message}`);
