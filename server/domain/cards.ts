/** Only Stripe's published test numbers are recognised; anything else is invalid so real cards are never accepted. */
export function classifyTestCard(n: string): 'success' | 'declined' | 'invalid' {
  const digits = n.replace(/[\s-]/g, '');
  if (digits === '4242424242424242') return 'success';
  if (digits === '4000000000000002') return 'declined';
  return 'invalid';
}
