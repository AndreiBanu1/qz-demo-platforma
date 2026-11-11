import { z } from 'zod';
import { normalizeEmail } from '../server/auth/email';

const email = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.string().max(254).regex(/^[^\s@]+@[^\s@]+$/));

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email,
  // Upper bound keeps PBKDF2 input (and the cost of a hostile request) bounded.
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
