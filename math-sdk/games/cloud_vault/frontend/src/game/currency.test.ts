import { expect, it } from 'vitest';
import { WIN_MAX_DIGITS, formatCurrency, formatPlain } from './currency';

it('keeps easing fractions out of ordinary cash and cluster labels', () => {
  expect(formatCurrency(1.735025, 'USD', 'en-US', 3.2)).toBe('$1.74');
  expect(formatPlain(0.199581, 'USD', 0.2)).toBe('0.20');
});

it('shows balances and other cash with at most the currency decimals', () => {
  expect(formatCurrency(123.456789, 'USD')).toBe('$123.46');
  expect(formatCurrency(0.001, 'USD')).toBe('$0.00');
  expect(formatCurrency(1500.4, 'JPY')).toBe('¥1,500');
  expect(formatCurrency(12.3456, 'XSC')).toBe('12.35 SC');
});

it('shows wins with up to 4 decimals and never more', () => {
  expect(formatCurrency(0.123456, 'USD', 'en-US', 0.123456, WIN_MAX_DIGITS)).toBe('$0.1235');
  expect(formatCurrency(0.1, 'USD', 'en-US', 0.1, WIN_MAX_DIGITS)).toBe('$0.10');
  expect(formatCurrency(0.105, 'USD', 'en-US', 0.105, WIN_MAX_DIGITS)).toBe('$0.105');
  expect(formatPlain(0.00010486, 'USD', 0.000123)).toBe('0.0001');
  expect(formatCurrency(0.00351, 'JPY', 'en-US', 0.005, WIN_MAX_DIGITS)).toBe('¥0.004');
});
