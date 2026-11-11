import { expect, it } from 'vitest';
import { classifyTestCard } from '../../server/domain/cards';

it('classifies Stripe test cards', () => {
  expect(classifyTestCard('4242 4242 4242 4242')).toBe('success');
  expect(classifyTestCard('4000-0000-0000-0002')).toBe('declined');
  expect(classifyTestCard('5555555555554444')).toBe('invalid');
  expect(classifyTestCard('')).toBe('invalid');
});
