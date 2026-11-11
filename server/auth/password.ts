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
