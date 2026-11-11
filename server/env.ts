import type { BugId } from './bugs/registry';

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  COOKIE_SECRET: string;
  DEMO_RESET_TOKEN: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_ENABLED?: string;
  BUGS_ENABLED?: string;
  DEMO_NOW?: string;
  /** `true` switches on the test-only /__demo/fixtures/* routes. Local only; unset in production. */
  DEMO_FIXTURES?: string;
  PBKDF2_ITERATIONS?: string;
};

export type SessionUser = { id: string; email: string; name: string; role: 'client' | 'admin' };

/** Hono context variables. */
export type Vars = {
  user: SessionUser | null;
  bugs: Set<BugId>;
};
