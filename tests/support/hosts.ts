import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hosts: { local: string[]; public: string[] } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../config/hosts.json', import.meta.url)), 'utf8'),
);

const DEFAULT_TARGET = 'http://127.0.0.1:8787';
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

/** Resolve the target URL, refusing any host not listed in config/hosts.json. */
export function resolveTarget(raw?: string): URL {
  const url = new URL(raw || DEFAULT_TARGET);
  const allowed = [...hosts.local, ...hosts.public];
  if (!allowed.includes(url.hostname)) {
    throw new Error(`Target host not allowed: ${url.hostname}`);
  }
  return url;
}

/** True for 127.0.0.1 and localhost only. */
export function isLocalTarget(url: URL | string | undefined): boolean {
  if (!url) return false;
  return LOCAL_HOSTS.includes(new URL(url).hostname);
}

/** Load and brute-force style tests may only ever run against a local copy. */
export function assertLocalOnly(url: URL): void {
  if (!isLocalTarget(url)) {
    throw new Error(`Local-only test refused for host: ${url.hostname}`);
  }
}
