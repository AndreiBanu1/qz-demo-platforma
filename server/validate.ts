import type { Context } from 'hono';
import type { z } from 'zod';
import { AppError } from './errors';

/** Parses the JSON body with `schema`. A malformed body or a schema failure is a 400 VALIDATION. */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError(400, 'VALIDATION');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new AppError(400, 'VALIDATION', result.error.issues);
  return result.data;
}
