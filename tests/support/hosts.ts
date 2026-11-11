import hosts from '../../config/hosts.json';

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

/** Load and brute-force style tests may only ever run against a local copy. */
export function assertLocalOnly(url: URL): void {
  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(`Local-only test refused for host: ${url.hostname}`);
  }
}
