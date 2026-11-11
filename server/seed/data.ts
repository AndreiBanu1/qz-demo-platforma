import { DEMO_ACCOUNTS } from '../../shared/demo-accounts';

export type SeedService = { id: string; name: string; durationMin: number; priceLei: number };
export type SeedStylist = { id: string; name: string; avatar: string };
export type SeedAccount = {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'admin';
  /** Public demo password, printed on the login page (kept in shared/demo-accounts.ts). */
  password: string;
  /** Precomputed with scripts/hash-password.ts (PBKDF2-SHA256, 20000 iterations). Nothing hashes at reset time. */
  passwordHash: string;
};

export const SERVICES: SeedService[] = [
  { id: 'tuns-dama', name: 'Tuns damă', durationMin: 45, priceLei: 120 },
  { id: 'tuns-barbati', name: 'Tuns bărbați', durationMin: 30, priceLei: 60 },
  { id: 'vopsit-radacini', name: 'Vopsit rădăcini', durationMin: 90, priceLei: 180 },
  { id: 'vopsit-complet', name: 'Vopsit complet', durationMin: 120, priceLei: 280 },
  { id: 'coafat', name: 'Coafat', durationMin: 45, priceLei: 100 },
  { id: 'manichiura', name: 'Manichiură', durationMin: 60, priceLei: 90 },
];

// Invented first names, illustrated avatars (the SVG files live in web/public/avatars).
export const STYLISTS: SeedStylist[] = [
  { id: 'stylist-iona', name: 'Iona', avatar: '/avatars/iona.svg' },
  { id: 'stylist-dorina', name: 'Dorina', avatar: '/avatars/dorina.svg' },
  { id: 'stylist-lucian', name: 'Lucian', avatar: '/avatars/lucian.svg' },
];

/** Precomputed with scripts/hash-password.ts (PBKDF2-SHA256, 20000 iterations). Nothing hashes at reset time. */
const PASSWORD_HASHES: Record<string, string> = {
  'user-admin': 'pbkdf2-sha256$20000$h2OKKl9xyFrcio+9LckwBQ==$t7CLvplMgisafla3ZTG6Yjtjz/dYZyr/02GMnMCxOIQ=',
  'user-ana': 'pbkdf2-sha256$20000$200OECkD2xYu9O6sHg3MLA==$99Z1pC9WbK/zqabSpyFT2fxrM4fnPZZXzuKdWKpcCdc=',
  'user-mihai': 'pbkdf2-sha256$20000$uvfQiavNao+WoVxqstS/4w==$gcaF6N0aMCbdDppjCs9sE9hK8Kg60lQDZWjcJvyKc+A=',
};

export const SEED_ACCOUNTS: SeedAccount[] = DEMO_ACCOUNTS.map((a) => ({ ...a, passwordHash: PASSWORD_HASHES[a.id] }));
