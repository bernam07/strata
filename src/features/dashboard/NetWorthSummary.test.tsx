import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { money } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import { NetWorthSummary } from './NetWorthSummary';

const netWorth: NetWorth = {
  assets: [],
  liabilities: [],
  totalAssets: money('12000'),
  totalLiabilities: money('2000'),
  net: money('10000'),
};

const series = [
  { date: '2026-01-01', value: 8000 },
  { date: '2026-06-01', value: 10000 },
];

describe('NetWorthSummary', () => {
  it('shows the net worth and a positive change over the period', () => {
    render(<NetWorthSummary netWorth={netWorth} series={series} basisLabel="market value" />);
    expect(screen.getByText(/10,000/)).toBeInTheDocument();
    expect(screen.getByText(/▲/)).toBeInTheDocument();
    expect(screen.getByText(/market value/)).toBeInTheDocument();
  });

  it('renders today P/L when provided', () => {
    render(<NetWorthSummary netWorth={netWorth} series={series} today={money('-42.5')} />);
    expect(screen.getByText(/today/)).toBeInTheDocument();
  });

  it('omits the change line without enough history', () => {
    render(<NetWorthSummary netWorth={netWorth} series={[series[0]!]} />);
    expect(screen.queryByText(/▲|▼/)).not.toBeInTheDocument();
  });
});
