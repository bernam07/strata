import { describe, expect, it } from 'vitest';
import { add, formatEur, isNegative, money, negate, sum, zero } from './money';

describe('money', () => {
  it('adds without floating point drift', () => {
    expect(add(money('0.1'), money('0.2')).toString()).toBe('0.3');
  });

  it('sums an empty list to zero', () => {
    expect(sum([]).equals(zero())).toBe(true);
  });

  it('sums a list exactly', () => {
    const total = sum([money('100.00'), money('-30.00'), money('0.01')]);
    expect(total.toString()).toBe('70.01');
  });

  it('detects negative balances', () => {
    expect(isNegative(money('-0.01'))).toBe(true);
    expect(isNegative(zero())).toBe(false);
  });

  it('negates', () => {
    expect(negate(money('42.5')).toString()).toBe('-42.5');
  });

  it('formats euros with banker rounding to two places', () => {
    expect(formatEur(money('70'))).toContain('70.00');
    expect(formatEur(money('-1234.5'))).toContain('1,234.50');
  });
});
