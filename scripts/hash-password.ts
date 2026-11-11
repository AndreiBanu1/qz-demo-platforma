// Usage: node scripts/hash-password.ts <password> [iterations]
// Prints a password hash in the format the Worker verifies. Used to precompute the seed hashes.
import { hashPassword } from '../server/auth/password.ts';

const [pw, iterations = '20000'] = process.argv.slice(2);
if (!pw) {
  console.error('Usage: node scripts/hash-password.ts <password> [iterations]');
  process.exit(1);
}
console.log(await hashPassword(pw, Number(iterations)));
