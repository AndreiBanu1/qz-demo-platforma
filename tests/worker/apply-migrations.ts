import { applyD1Migrations, env } from 'cloudflare:test';

// Runs before each test file; applyD1Migrations is idempotent.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
