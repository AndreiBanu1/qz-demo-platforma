// Builds the web app, applies local migrations, then serves the Worker on 127.0.0.1:8787.
import { spawnSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('.dev.vars')) copyFileSync('.dev.vars.example', '.dev.vars');

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
