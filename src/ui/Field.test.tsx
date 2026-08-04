import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MoneyInput, sanitizeAmount } from './Field';

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
});
