export type PaymentRow = {
  id: string;
  booking_id: string;
  provider: string;
  status: string;
  card_last4: string | null;
  external_id: string | null;
  created_at: string;
};

export type NewPayment = Omit<PaymentRow, 'id' | 'created_at'>;

/** Returns false when a payment with the same external_id already exists (idempotent webhooks). */
export async function insertPayment(db: D1Database, p: NewPayment, now: Date): Promise<boolean> {
  const r = await db
    .prepare(
      `INSERT INTO payments (id,booking_id,provider,status,card_last4,external_id,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)
       ON CONFLICT(external_id) DO NOTHING`,
    )
    .bind(crypto.randomUUID(), p.booking_id, p.provider, p.status, p.card_last4, p.external_id, now.toISOString())
    .run();
  return r.meta.changes === 1;
}

export async function listPaymentsForBooking(db: D1Database, bookingId: string): Promise<PaymentRow[]> {
  const r = await db
    .prepare('SELECT * FROM payments WHERE booking_id = ?1 ORDER BY created_at')
    .bind(bookingId)
    .all<PaymentRow>();
  return r.results;
}
