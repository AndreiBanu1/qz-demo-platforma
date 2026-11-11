const KEY_BYTES = 32;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Derives a PBKDF2-SHA256 key and returns `pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>`. */
export async function hashPassword(pw: string, iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, KEY_BYTES * 8);
  return `pbkdf2-sha256$${iterations}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s);
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Compares two byte arrays without stopping at the first difference. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Checks a password against a stored hash. The iteration count is read from the stored string. */
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = Number(iterStr);
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 1 || !saltB64 || !hashB64) {
    return false;
  }
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  if (!salt || !expected) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8);
  return constantTimeEqual(new Uint8Array(bits), expected);
}

/** Iteration count for new hashes: `PBKDF2_ITERATIONS`, default 20000 (Task 13 measures the real value). */
export function iterationsFor(env: { PBKDF2_ITERATIONS?: string }): number {
  const n = Number(env.PBKDF2_ITERATIONS);
  return Number.isInteger(n) && n > 0 ? n : 20000;
}
