import { expect } from '@playwright/test';
import { requestFor } from '../support/bugs';
import { createClient } from '../support/fixtures';
import { resolveTarget } from '../support/hosts';
import { randomAprilStart, type CheckFixtures } from './types';

/** Another client's booking is a 404, not the booking and not a 403 (ids cannot be probed). */
export async function bookingAccessControl({ context }: CheckFixtures): Promise<void> {
  const baseURL = resolveTarget(process.env.TARGET).href;
  const owner = await createClient(baseURL);
  const other = await createClient(baseURL);
  const ownerApi = await requestFor(context, owner.cookie);
  const otherApi = await requestFor(context, other.cookie);
  try {
    const created = await ownerApi.post('/api/bookings', {
      data: { serviceId: 'tuns-barbati', stylistId: 'stylist-iona', start: randomAprilStart() },
    });
    expect(created.status(), 'owner could not book').toBe(201);
    const { id } = await created.json();
    expect((await ownerApi.get(`/api/bookings/${id}`)).status(), 'owner cannot read own booking').toBe(200);

    const theirs = await otherApi.get(`/api/bookings/${id}`);
    expect(theirs.status(), "[check:bookingAccessControl] another client's booking status").toBe(404);
    expect(await theirs.text(), '[check:bookingAccessControl] body shows the owner').not.toContain(owner.email);
  } finally {
    await ownerApi.dispose();
    await otherApi.dispose();
    await owner.request.dispose();
    await other.request.dispose();
  }
}
