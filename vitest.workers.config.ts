import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/** The public, local-only test values. Read here so the tests don't depend on an untracked .dev.vars (CI has none). */
function devVarsExample(): Record<string, string> {
  const text = readFileSync(path.join(import.meta.dirname, '.dev.vars.example'), 'utf8');
  const vars: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'server/db/migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: { bindings: { ...devVarsExample(), TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ['tests/worker/**/*.test.ts'],
      setupFiles: ['./tests/worker/apply-migrations.ts'],
    },
  };
});
