import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Account, Transaction } from '@/core/types';
import { TransactionList } from './TransactionList';

vi.mock('@/features/expenses/api/useCategories', () => ({
  useCategories: () => ({ data: [] }),
  useAssignments: () => ({ data: new Map() }),
  useAssignCategory: () => ({ mutate: vi.fn() }),
  useAssignCategoriesBulk: () => ({ mutate: vi.fn() }),
}));

vi.mock('../api/useTransactions', () => ({
  useConfirmWalletTransaction: () => ({ mutate: vi.fn() }),
}));

const mockAccount: Account = {
  id: 'acc-1',
  name: 'ActivoBank Checking',
  type: 'cash',
  currency: 'EUR',
  institutionId: 'activobank',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const makeTx = (id: string, amount: string, note: string, occurredAt: string): Transaction => ({
  id,
  accountId: 'acc-1',
  kind: Number(amount) < 0 ? 'expense' : 'income',
  amount,
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt,
  note,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  instrumentId: null,
  createdAt: occurredAt,
});

describe('TransactionList', () => {
  it('limits displayed transactions when initialLimit is specified and allows loading more', () => {
    const transactions: Transaction[] = [];
    for (let i = 1; i <= 10; i++) {
      transactions.push(
        makeTx(`tx-${i}`, '-10', `Coffee ${i}`, `2026-10-0${Math.min(9, i)}T10:00:00Z`),
      );
    }

    render(
      <TransactionList
        transactions={transactions}
        accounts={[mockAccount]}
        initialLimit={4}
        pageSize={3}
      />,
    );

    // Initial limit is 4: first 4 items should be rendered
    expect(screen.getByText('Coffee 1')).toBeInTheDocument();
    expect(screen.getByText('Coffee 4')).toBeInTheDocument();
    expect(screen.queryByText('Coffee 5')).not.toBeInTheDocument();

    // Button should show 6 remaining
    const showMoreBtn = screen.getByRole('button', { name: /show more \(6 remaining\)/i });
    expect(showMoreBtn).toBeInTheDocument();

    // Click Show more (pageSize is 3, so 4 + 3 = 7 items)
    fireEvent.click(showMoreBtn);

    expect(screen.getByText('Coffee 5')).toBeInTheDocument();
    expect(screen.getByText('Coffee 7')).toBeInTheDocument();
    expect(screen.queryByText('Coffee 8')).not.toBeInTheDocument();

    // Now 3 remaining. Since remaining equals pageSize (3), clicking Show more loads the rest
    const nextShowMoreBtn = screen.getByRole('button', { name: /show more \(3 remaining\)/i });
    expect(nextShowMoreBtn).toBeInTheDocument();
    fireEvent.click(nextShowMoreBtn);

    expect(screen.getByText('Coffee 8')).toBeInTheDocument();
    expect(screen.getByText('Coffee 10')).toBeInTheDocument();
    expect(screen.getByText('Showing all 10 movements')).toBeInTheDocument();
  });

  it('renders kind arrows in sunken containers instead of big bank logos', () => {
    const transactions = [
      makeTx('tx-income', '500', 'Salary', '2026-10-09T10:00:00Z'),
      makeTx('tx-expense', '-35', 'Groceries', '2026-10-09T11:00:00Z'),
    ];

    const { container } = render(
      <TransactionList
        transactions={transactions}
        accounts={[mockAccount]}
        showAccount={true}
      />,
    );

    // Should have sunken rounded-xl containers for the arrow icons
    const iconContainers = container.querySelectorAll('.grid.h-9.w-9.place-items-center.rounded-xl');
    expect(iconContainers.length).toBe(2);

    // Should render mini institution logos when showAccount is true
    const miniLogos = container.querySelectorAll('.absolute.-bottom-1.-right-1');
    expect(miniLogos.length).toBe(2);
  });
});
