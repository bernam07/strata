import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenchmarkCard } from './BenchmarkCard';

const mockInvestments = vi.fn();
const mockQuote = vi.fn();

vi.mock('@/features/dashboard/api/useNetWorthHistory', () => ({
  useInvestmentsHistory: () => mockInvestments(),
}));
vi.mock('@/features/search/api/useMarket', () => ({
  useQuote: () => mockQuote(),
}));

describe('BenchmarkCard', () => {
  it('prompts to build history when there are fewer than two points', () => {
    mockInvestments.mockReturnValue({ data: [{ date: '2026-08-01', value: 100 }] });
    mockQuote.mockReturnValue({ data: undefined });
    render(<BenchmarkCard />);
    expect(screen.getByText(/Not enough investment history/i)).toBeInTheDocument();
  });

  it('compares portfolio and index returns when both series exist', () => {
    mockInvestments.mockReturnValue({
      data: [
        { date: '2026-01-01', value: 1000 },
        { date: '2026-06-01', value: 1200 },
      ],
    });
    mockQuote.mockReturnValue({
      data: {
        history: [
          { date: '2026-01-01', value: 400 },
          { date: '2026-06-01', value: 440 },
        ],
      },
    });
    render(<BenchmarkCard />);
    expect(screen.getByText('Your portfolio vs the market')).toBeInTheDocument();
    expect(screen.getByText('+20.0%')).toBeInTheDocument(); // portfolio 1000 → 1200
    expect(screen.getByText('+10.0%')).toBeInTheDocument(); // index 400 → 440
  });
});
