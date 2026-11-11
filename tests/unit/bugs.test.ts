import { expect, test } from 'vitest';
import { BUG_IDS, BUG_LABELS, parseBugs } from '../../server/bugs/registry';

test('parseBugs drops unknown ids and de-duplicates', () => {
  expect(parseBugs('slow-login,nope,slow-login')).toEqual(['slow-login']);
});

test('parseBugs: all turns on every bug, off and empty turn on none', () => {
  expect(parseBugs('all')).toHaveLength(6);
  expect(parseBugs('all')).toEqual([...BUG_IDS]);
  expect(parseBugs('off')).toEqual([]);
  expect(parseBugs('')).toEqual([]);
});

test('parseBugs tolerates spaces and case', () => {
  expect(parseBugs(' Slow-Login , idor-booking ')).toEqual(['slow-login', 'idor-booking']);
});

test('the six ids and their strip labels are exact', () => {
  expect([...BUG_IDS]).toEqual([
    'slow-login',
    'login-enumeration',
    'booking-past-closing',
    'a11y-gap',
    'leaky-errors',
    'idor-booking',
  ]);
  expect(BUG_LABELS).toEqual({
    'slow-login': 'login lent',
    'login-enumeration': 'mesaje de login prea clare',
    'booking-past-closing': 'programare după închidere',
    'a11y-gap': 'accesibilitate stricată',
    'leaky-errors': 'erori cu detalii interne',
    'idor-booking': 'acces la programările altora',
  });
});
