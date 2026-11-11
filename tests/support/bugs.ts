import { request as pwRequest, type APIRequestContext, type BrowserContext } from '@playwright/test';
import type { BugId } from '../../server/bugs/registry';
import type { Client } from './fixtures';
import { resolveTarget } from './hosts';

const cookiePair = (res: { headersArray(): { name: string; value: string }[] }, name: string) =>
  res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .find((kv) => kv.startsWith(`${name}=`));

/**
 * Turns bugs on for one session: POSTs /__demo/bugs and returns a new context that carries the qz_bugs
 * cookie (and the client's session cookie, if given a Client) explicitly, like the other fixtures (R8).
 * The caller disposes the returned context.
 */
export async function withBugs(subject: APIRequestContext | Client, ids: BugId[] | 'all'): Promise<APIRequestContext> {
  const baseURL = resolveTarget(process.env.TARGET);
  const origin = baseURL.origin;
  const isClient = 'request' in subject;
  const ctx = isClient ? subject.request : subject;
  const res = await ctx.post('/__demo/bugs', {
    data: { ids: ids === 'all' ? 'all' : ids.join(',') },
    headers: { Origin: origin },
  });
  if (res.status() !== 200) throw new Error(`POST /__demo/bugs failed: ${res.status()}`);
  const bugs = cookiePair(res, 'qz_bugs');
  if (!bugs) throw new Error('POST /__demo/bugs set no qz_bugs cookie');
  const cookie = [isClient ? subject.cookie : undefined, bugs].filter(Boolean).join('; ');
  return pwRequest.newContext({ baseURL: baseURL.href, extraHTTPHeaders: { Origin: origin, Cookie: cookie } });
}

/**
 * Turns bugs on for a whole browser session: the `qz_bugs` cookie goes into the BrowserContext (so pages see the
 * bug) and is returned as a `qz_bugs=...` pair for API contexts built with `requestFor`.
 */
export async function enableBugsInBrowser(context: BrowserContext, ids: BugId[] | 'all'): Promise<void> {
  const baseURL = resolveTarget(process.env.TARGET);
  const res = await context.request.post(new URL('/__demo/bugs', baseURL).href, {
    data: { ids: ids === 'all' ? 'all' : ids.join(',') },
    headers: { Origin: baseURL.origin },
  });
  if (res.status() !== 200) throw new Error(`POST /__demo/bugs failed: ${res.status()}`);
  const pair = cookiePair(res, 'qz_bugs');
  if (!pair) throw new Error('POST /__demo/bugs set no qz_bugs cookie');
  const eq = pair.indexOf('=');
  // Set explicitly: the cookie is Secure and the target is http://127.0.0.1 (ruling R8).
  await context.addCookies([{ name: 'qz_bugs', value: pair.slice(eq + 1), url: baseURL.origin }]);
}

/**
 * A fresh API context for one check. It carries the session cookie (if any) and the `qz_bugs` cookie held by the
 * browser context (if any), so a check behaves the same on a clean session and in bug-catcher. The caller disposes it.
 * Each request gets a random CF-Connecting-IP, so failed logins never fill the shared 127.0.0.1 per-IP budget.
 */
export async function requestFor(context: BrowserContext, sessionCookie?: string): Promise<APIRequestContext> {
  const baseURL = resolveTarget(process.env.TARGET);
  const bugs = (await context.cookies(baseURL.origin)).find((c) => c.name === 'qz_bugs');
  const cookie = [sessionCookie, bugs && `qz_bugs=${bugs.value}`].filter(Boolean).join('; ');
  const ip = `10.${rnd()}.${rnd()}.${1 + rnd()}`;
  return pwRequest.newContext({
    baseURL: baseURL.href,
    extraHTTPHeaders: { Origin: baseURL.origin, 'CF-Connecting-IP': ip, ...(cookie ? { Cookie: cookie } : {}) },
  });
}
const rnd = () => Math.floor(Math.random() * 250);
