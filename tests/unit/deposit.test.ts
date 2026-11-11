import { expect, it } from 'vitest';
import { depositLei } from '../../server/domain/deposit';

it('is 30% rounded, at least 20 lei', () => {
  expect(depositLei(150)).toBe(45);
  expect(depositLei(40)).toBe(20);
  expect(depositLei(55)).toBe(20);
  expect(depositLei(85)).toBe(26);
});
