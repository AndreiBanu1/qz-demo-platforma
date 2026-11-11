// Builds the web app, applies local migrations, then serves the Worker on 127.0.0.1:8787.
import { spawnSync, spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';

if (!existsSync('.dev.vars')) {
  copyFileSync('.dev.vars.example', '.dev.vars');
} else {
  // Older checkouts: add any key the example now has that .dev.vars lacks. Existing values are never changed.
  const keyOf = (line) => /^\s*([A-Z0-9_]+)\s*=/.exec(line)?.[1];
  const have = new Set(readFileSync('.dev.vars', 'utf8').split('\n').map(keyOf).filter(Boolean));
  const missing = readFileSync('.dev.vars.example', 'utf8')
    .split('\n')
    .filter((line) => keyOf(line) && !have.has(keyOf(line)));
  if (missing.length) appendFileSync('.dev.vars', `${readFileSync('.dev.vars', 'utf8').endsWith('\n') ? '' : '\n'}${missing.join('\n')}\n`);
}

for (const args of [['run', 'build'], ['run', 'db:migrate:local']]) {
  const r = spawnSync('npm', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const child = spawn(
  'npx',
  ['wrangler', 'dev', '--ip', '127.0.0.1', '--port', '8787', '--var', 'DEMO_NOW:2026-12-07T08:00:00.000Z'],
  { stdio: 'inherit' },
);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
