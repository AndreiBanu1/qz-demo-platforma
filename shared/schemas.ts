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

/** A real YYYY-MM-DD calendar date (rejects 2026-02-30 and the like). */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  });

export const slotsQuerySchema = z.object({
  serviceId: z.string().min(1).max(64),
  date: calendarDate,
  stylistId: z.string().min(1).max(64).optional(),
});

export const createBookingSchema = z.object({
  serviceId: z.string().min(1).max(64),
  stylistId: z.string().min(1).max(64),
  start: z.iso.datetime({ offset: true }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export type ServiceDto = { id: string; name: string; durationMin: number; priceLei: number };
export type StylistDto = { id: string; name: string; avatar: string };
export type SlotDto = { stylistId: string; start: string };
export type SlotsResponse = { slots: SlotDto[] };
export type BookingStatusDto = 'pending_payment' | 'confirmed' | 'cancelled';
export type BookingDto = {
  id: string;
  serviceId: string;
  stylistId: string;
  start: string;
  end: string;
  status: BookingStatusDto;
  depositLei: number;
  holdUntil: string | null;
  refunded: boolean;
};
export type CreateBookingResponse = {
  id: string;
  status: 'pending_payment';
  depositLei: number;
  holdUntil: string;
};
export type CancelBookingResponse = { status: 'cancelled'; refunded: boolean };
