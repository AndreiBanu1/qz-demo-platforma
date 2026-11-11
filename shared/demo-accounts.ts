/** The public demo accounts. Their passwords are printed on the login page, so they are safe to ship to the SPA. */
export type DemoAccount = {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'admin';
  password: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: 'user-admin', email: 'admin@bucla-verde.test', name: 'Administrator Demo', role: 'admin', password: 'Frunza-Admin-2026' },
  { id: 'user-ana', email: 'ana@bucla-verde.test', name: 'Ana Demo', role: 'client', password: 'Ana-Salon-2026' },
  { id: 'user-mihai', email: 'mihai@bucla-verde.test', name: 'Mihai Demo', role: 'client', password: 'Mihai-Salon-2026' },
];
