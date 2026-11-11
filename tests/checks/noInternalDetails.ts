import { expect } from '@playwright/test';
import { requestFor } from '../support/bugs';
import { createClient } from '../support/fixtures';
import { resolveTarget } from '../support/hosts';
import type { CheckFixtures } from './types';

/** A malformed `start` is a 400 in the standard shape, and the body shows no SQL, stack trace or source file names. */
export async function noInternalDetails({ context }: CheckFixtures): Promise<void> {
  const client = await createClient(resolveTarget(process.env.TARGET).href);
  const api = await requestFor(context, client.cookie);
  try {
    const res = await api.post('/api/bookings', {
      data: { serviceId: 'tuns-dama', stylistId: 'stylist-lucian', start: '2026-13-45T99:00' },
    });
    const text = await res.text();
    // The leak assertions come first, so a leaking response fails on what it leaks, not just on its status.
    expect(text, '[check:noInternalDetails] body leaks SQL (SELECT)').not.toContain('SELECT');
    expect(text, '[check:noInternalDetails] body leaks a stack field').not.toContain('stack');
    expect(text, '[check:noInternalDetails] body leaks a source file name (.ts)').not.toContain('.ts');
    // A real stack trace: "at" at the start of an indented line. In JSON the newline is written as \n.
    expect(text, '[check:noInternalDetails] body leaks a stack trace').not.toMatch(/(?:\n|\\n)\s+at /);
    expect(res.status(), 'malformed start is not a 400').toBe(400);
    expect(JSON.parse(text).error.code, 'error code').toBe('VALIDATION');
  } finally {
    await api.dispose();
    await client.request.dispose();
  }
}
