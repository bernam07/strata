import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { money } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import { NetWorthDonut } from './NetWorthDonut';

const account = (id: string, name: string) => ({
  id,
  institutionId: 'revolut',
  name,
  type: 'cash' as const,
  currency: 'EUR',
  createdAt: '',
  archivedAt: null,
});

const netWorth: NetWorth = {
  assets: [{ account: account('a', 'Savings'), balance: money('7500') }],
  liabilities: [{ account: account('b', 'Card'), balance: money('-2500') }],
  totalAssets: money('7500'),
  totalLiabilities: money('2500'),
  net: money('5000'),
};

const renderDonut = () =>
  render(
    <MemoryRouter>
      <NetWorthDonut netWorth={netWorth} today={money('12')} />
    </MemoryRouter>,
  );

describe('NetWorthDonut', () => {
  it('shows the total net worth in the centre and lists each account', () => {
    renderDonut();
    expect(screen.getByText('Net worth')).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
  });

  it('shows each account share as a percentage', () => {
    renderDonut();
    // 7500 and 2500 of a 10000 gross → 75% and 25%
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('links each account to its detail page', () => {
    renderDonut();
    expect(screen.getByText('Savings').closest('a')).toHaveAttribute(
      'href',
      '/accounts/a',
    );
  });
});
