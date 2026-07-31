import type { Money } from '../money/money';
import { money, negate } from '../money/money';
import type { TransactionKind } from '../types';

type Direction = 'inflow' | 'outflow';

interface KindMeta {
  label: string;
  direction: Direction;
}

export const kindMeta: Record<TransactionKind, KindMeta> = {
  deposit: { label: 'Deposit', direction: 'inflow' },
  income: { label: 'Income', direction: 'inflow' },
  sell: { label: 'Sell', direction: 'inflow' },
  dividend: { label: 'Dividend', direction: 'inflow' },
  interest: { label: 'Interest', direction: 'inflow' },
  withdrawal: { label: 'Withdrawal', direction: 'outflow' },
  expense: { label: 'Expense', direction: 'outflow' },
  buy: { label: 'Buy', direction: 'outflow' },
  fee: { label: 'Fee', direction: 'outflow' },
  transfer: { label: 'Transfer', direction: 'outflow' },
  adjustment: { label: 'Adjustment', direction: 'inflow' },
};

export const manualKinds: readonly TransactionKind[] = [
  'deposit',
  'expense',
  'income',
  'withdrawal',
  'dividend',
  'interest',
  'fee',
  'adjustment',
];

export const signedAmount = (
  kind: TransactionKind,
  magnitude: Money,
): Money => {
  const absolute = magnitude.abs();
  return kindMeta[kind].direction === 'outflow' ? negate(absolute) : absolute;
};

export const parseSignedAmount = (
  kind: TransactionKind,
  input: string,
): Money => signedAmount(kind, money(input));
