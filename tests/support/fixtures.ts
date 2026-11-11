import { test as base, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { SEED_ACCOUNTS } from '../../server/seed/data';

export type Client = {
  email: string;
  password: string;
  name: string;
  /** An isolated request context that carries this user's session cookie. */
  request: APIRequestContext;
};

type Fixtures = {
  /** A fresh client account (`user-<uuid>@exemplu.test`), signed up and logged in. */
  newClient: () => Promise<Client>;
  /** The seeded admin, logged in. */
  asAdmin: () => Promise<Client>;
};

/**
 * Logs in on a fresh context and carries the session cookie explicitly in a Cookie header (ruling R8):
 * the cookie is `Secure`, and an API context may drop it over http://127.0.0.1.
 */
async function loginClient(baseURL: string, email: string, password: string, name: string): Promise<Client> {
  const origin = new URL(baseURL).origin;
  const bare = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: origin } });
  const res = await bare.post('/api/auth/login', { data: { email, password } });
  if (res.status() !== 200) throw new Error(`login failed for ${email}: ${res.status()}`);
  const cookie = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .find((kv) => kv.startsWith('qz_session='));
  await bare.dispose();
  if (!cookie) throw new Error('login returned no qz_session cookie');
  const request = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: origin, Cookie: cookie },
  });
  return { email, password, name, request };
}

export const test = base.extend<Fixtures>({
  newClient: async ({ baseURL }, use) => {
    const made: Client[] = [];
    await use(async () => {
      const origin = new URL(baseURL!).origin;
      const email = `user-${crypto.randomUUID()}@exemplu.test`;
      const password = 'parola-de-test-1';
      const name = 'Client Test';
      const anon = await pwRequest.newContext({ baseURL: baseURL!, extraHTTPHeaders: { Origin: origin } });
      const res = await anon.post('/api/auth/signup', { data: { name, email, password } });
      await anon.dispose();
      if (res.status() !== 201) throw new Error(`sign-up failed: ${res.status()}`);
      const client = await loginClient(baseURL!, email, password, name);
      made.push(client);
      return client;
    });
    for (const c of made) await c.request.dispose();
  },
  asAdmin: async ({ baseURL }, use) => {
    const made: Client[] = [];
    await use(async () => {
      const admin = SEED_ACCOUNTS.find((a) => a.role === 'admin')!;
      const client = await loginClient(baseURL!, admin.email, admin.password, admin.name);
      made.push(client);
      return client;
    });
    for (const c of made) await c.request.dispose();
  },
});

export { expect } from '@playwright/test';
