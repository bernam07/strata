import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceChart } from './PriceChart';

describe('PriceChart', () => {
  it('shows a placeholder with fewer than two points', () => {
    render(<PriceChart points={[{ date: '2026-01-01', value: 10 }]} />);
    expect(screen.getByText(/builds up/i)).toBeInTheDocument();
  });

  it('reads out the latest price and the min–max range', () => {
    render(
      <PriceChart
        currency="USD"
        points={[
          { date: '2026-01-01', value: 100 },
          { date: '2026-02-01', value: 90 },
          { date: '2026-03-01', value: 120 },
        ]}
      />,
    );
    expect(screen.getByText(/01 Mar 2026/)).toBeInTheDocument();
    expect(screen.getByText(/90\.00\s*–\s*.*120\.00/)).toBeInTheDocument();
  });
});
