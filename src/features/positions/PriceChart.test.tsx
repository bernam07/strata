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

  it('renders average buy price badge and buy/sell trade markers', () => {
    render(
      <PriceChart
        currency="EUR"
        averagePrice={100}
        points={[
          { date: '2026-01-01', value: 95 },
          { date: '2026-02-01', value: 105 },
          { date: '2026-03-01', value: 120 },
        ]}
        markers={[
          {
            id: 'tx-1',
            date: '2026-01-02T10:00:00Z',
            kind: 'buy',
            quantity: 2.5,
            price: 95,
            amount: 237.5,
          },
          {
            id: 'tx-2',
            date: '2026-02-01T14:00:00Z',
            kind: 'sell',
            quantity: 1,
            price: 105,
            amount: 105,
          },
        ]}
      />,
    );
    expect(screen.getByText(/\+20\.0% vs avg/)).toBeInTheDocument();
    expect(screen.getByText(/1 buy/i)).toBeInTheDocument();
    expect(screen.getByText(/1 sell/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Buy 2.5 shares/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sell 1 shares/i }),
    ).toBeInTheDocument();
  });
});
