export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const GENERIC = 'A apărut o eroare. Încearcă din nou.';

let onUnauthorized: (() => void) | null = null;
/** Layout registers what a 401 does: forget the user and go to the login page. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

type Options = { body?: unknown; /** Calls where a 401 is an expected answer (login, /api/me). */ quiet401?: boolean };

export async function api<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Nu m-am putut conecta la server. Încearcă din nou.');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401 && !opts.quiet401) onUnauthorized?.();
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? GENERIC);
  }
  return data as T;
}

export const get = <T>(path: string, opts?: Options) => api<T>('GET', path, opts);
export const post = <T>(path: string, body?: unknown, opts?: Options) => api<T>('POST', path, { ...opts, body: body ?? {} });

export const messageOf = (e: unknown): string => (e instanceof ApiError ? e.message : GENERIC);
