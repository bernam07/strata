import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Transaction } from '@/core/types';
import { MonthlySummary } from './MonthlySummary';

const now = new Date();
const thisMonth = (day: number) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 12)).toISOString();

const tx = (
  amount: string,
  occurredAt: string,
  kind: Transaction['kind'],
): Transaction => ({
  id: crypto.randomUUID(),
  accountId: 'acc',
  kind,
  amount,
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt,
  note: null,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  instrumentId: null,
  createdAt: occurredAt,
});

const mockTransactions = vi.fn();
vi.mock('@/features/transactions/api/useTransactions', () => ({
  useTransactions: () => mockTransactions(),
}));

describe('MonthlySummary', () => {
  it('shows income, spending and net saved for the current month', () => {
    mockTransactions.mockReturnValue({
      data: [
        tx('2000', thisMonth(2), 'income'),
        tx('-40', thisMonth(10), 'expense'),
      ],
    });
    render(<MonthlySummary snapshots={[]} />);
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Spending')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getAllByText(/2,000/).length).toBeGreaterThan(0);
    expect(screen.getByText('+€1,960')).toBeInTheDocument(); // 2000 − 40 saved
  });

  it('renders nothing when the month has no activity', () => {
    mockTransactions.mockReturnValue({ data: [] });
    const { container } = render(<MonthlySummary snapshots={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
