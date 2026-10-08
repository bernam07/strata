import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Amount, AmountInline } from './Amount';

describe('Amount component', () => {
  it('correctly handles fractional rollover at .999 boundaries without rendering 100 cents', () => {
    render(<Amount value={19.999} />);
    // 19.999 rounded to 2 decimal places is 20.00
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('.00')).toBeInTheDocument();
  });

  it('renders standard values with thousands separator and cents', () => {
    render(<Amount value={1250.75} />);
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('.75')).toBeInTheDocument();
  });

  it('avoids displaying negative sign for -0.001', () => {
    const { container } = render(<Amount value={-0.001} sign />);
    expect(container.textContent).toContain('0');
    expect(container.textContent).not.toContain('−');
  });

  it('renders signed positive and negative values correctly', () => {
    const { container: pos } = render(<Amount value={45.5} sign />);
    expect(pos.textContent).toContain('+');

    const { container: neg } = render(<Amount value={-45.5} sign />);
    expect(neg.textContent).toContain('−');
  });
});

describe('AmountInline component', () => {
  it('formats inline euros with 2 decimal places', () => {
    render(<AmountInline value={120.5} />);
    expect(screen.getByText(/120\.50/)).toBeInTheDocument();
  });

  it('renders sign when signed prop is true', () => {
    render(<AmountInline value={50} signed />);
    expect(screen.getByText(/\+50\.00/)).toBeInTheDocument();
  });

  it('avoids displaying negative sign for near-zero value', () => {
    render(<AmountInline value={-0.001} signed />);
    expect(screen.getByText(/0\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/−0\.00/)).not.toBeInTheDocument();
  });
});
