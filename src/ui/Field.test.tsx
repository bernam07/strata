import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { evaluateMoneyExpression, MoneyInput, sanitizeAmount } from './Field';

const Controlled = () => {
  const [value, setValue] = useState('');
  return (
    <MoneyInput value={value} onChange={setValue} aria-label="amount" />
  );
};

describe('sanitizeAmount', () => {
  it('converts a comma decimal to a dot', () => {
    expect(sanitizeAmount('12,50')).toBe('12.50');
  });
  it('strips letters and stray symbols', () => {
    expect(sanitizeAmount('1a2€,3')).toBe('12.3');
  });
  it('collapses multiple separators into one', () => {
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
  });
});

describe('evaluateMoneyExpression', () => {
  it('evaluates addition, subtraction, multiplication, and division', () => {
    expect(evaluateMoneyExpression('14.50+8.20')).toBe(22.7);
    expect(evaluateMoneyExpression('48/3')).toBe(16);
    expect(evaluateMoneyExpression('12,5*2')).toBe(25);
  });

  it('evaluates plain numbers and returns null for invalid expressions', () => {
    expect(evaluateMoneyExpression('42.50')).toBe(42.5);
    expect(evaluateMoneyExpression('10/0')).toBeNull();
    expect(evaluateMoneyExpression('')).toBeNull();
  });
});

describe('MoneyInput', () => {
  it('normalizes a typed comma into a dot in the field value', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('amount') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9,99' } });
    expect(input.value).toBe('9.99');
  });

  it('offers the decimal keypad on mobile', () => {
    render(<Controlled />);
    expect(screen.getByLabelText('amount')).toHaveAttribute('inputmode', 'decimal');
  });

  it('evaluates a math expression when blurred', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('amount') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '14,5+5,5' } });
    fireEvent.blur(input);
    expect(input.value).toBe('20');
  });
});
