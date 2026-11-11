import type { BookingRow } from '../db/bookings';

/** A way to take the deposit. `redirectUrl` is set when the customer pays on a page we do not host. */
export interface PaymentProvider {
  name: 'simulated' | 'stripe';
  start(booking: BookingRow, origin: string): Promise<{ redirectUrl?: string }>;
}
