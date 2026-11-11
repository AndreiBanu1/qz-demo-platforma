export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SLOT_TAKEN'
  | 'HOLD_EXPIRED'
  | 'CANCEL_TOO_LATE'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_RESERVED'
  | 'EMAIL_TAKEN'
  | 'CARD_DECLINED'
  | 'NOT_TEST_CARD'
  | 'TOO_MANY_ATTEMPTS'
  | 'INTERNAL';

export const ERROR_COPY: Record<ErrorCode, string> = {
  VALIDATION: 'Datele trimise nu sunt valide.',
  UNAUTHENTICATED: 'Intră în cont ca să continui.',
  FORBIDDEN: 'Nu ai acces la această pagină.',
  NOT_FOUND: 'Nu am găsit ce cauți.',
  SLOT_TAKEN: 'Ora aleasă tocmai a fost rezervată. Alege altă oră.',
  HOLD_EXPIRED: 'Rezervarea a expirat. Alege din nou ora.',
  CANCEL_TOO_LATE: 'Programarea poate fi anulată cu cel puțin 24 de ore înainte.',
  INVALID_CREDENTIALS: 'Email sau parolă greșite',
  EMAIL_NOT_RESERVED: 'Folosește o adresă inventată, de exemplu ana@exemplu.test',
  EMAIL_TAKEN: 'Există deja un cont cu această adresă.',
  CARD_DECLINED: 'Cardul a fost refuzat. Încearcă alt card de test.',
  NOT_TEST_CARD: 'Folosește un card de test',
  TOO_MANY_ATTEMPTS: 'Prea multe încercări. Încearcă din nou în 15 minute.',
  INTERNAL: 'A apărut o eroare. Cod: {id}',
};

/** An error that maps to a status and a standard `{ error: { code, message } }` body. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly detail?: unknown,
  ) {
    super(code);
  }
}
