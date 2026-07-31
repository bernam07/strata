import { describe, expect, it } from 'vitest';
import { parseSignedAmount, signedAmount } from './kinds';
import { money } from '../money/money';

describe('signedAmount', () => {
  it('makes expenses negative regardless of input sign', () => {
    expect(signedAmount('expense', money('30')).toString()).toBe('-30');
    expect(signedAmount('expense', money('-30')).toString()).toBe('-30');
  });

  it('keeps deposits positive', () => {
    expect(signedAmount('deposit', money('100')).toString()).toBe('100');
    expect(signedAmount('deposit', money('-100')).toString()).toBe('100');
  });

  it('makes buys and fees outflows', () => {
    expect(signedAmount('buy', money('12.5')).toString()).toBe('-12.5');
    expect(signedAmount('fee', money('1')).toString()).toBe('-1');
  });

  it('parses a string magnitude into a signed amount', () => {
    expect(parseSignedAmount('expense', '30.00').toString()).toBe('-30');
    expect(parseSignedAmount('dividend', '4.20').toString()).toBe('4.2');
  });
});
