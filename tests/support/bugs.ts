import { request as pwRequest, type APIRequestContext } from '@playwright/test';
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
