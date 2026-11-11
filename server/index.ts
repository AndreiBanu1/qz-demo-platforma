import { createApp } from './app';
import { now } from './domain/time';
import type { Env } from './env';
import { resetDatabase } from './seed/reset';

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(resetDatabase(env.DB, now(env)));
  },
};
