import type { Money } from '../money/money';
import { money, negate } from '../money/money';
import type { TransactionKind } from '../types';

type Direction = 'inflow' | 'outflow';

interface KindMeta {
  label: string;
  direction: Direction;
}

export const kindMeta: Record<TransactionKind, KindMeta> = {
  deposit: { label: 'Depósito', direction: 'inflow' },
  income: { label: 'Receita', direction: 'inflow' },
  sell: { label: 'Venda', direction: 'inflow' },
  dividend: { label: 'Dividendo', direction: 'inflow' },
  interest: { label: 'Juros', direction: 'inflow' },
  withdrawal: { label: 'Levantamento', direction: 'outflow' },
  expense: { label: 'Despesa', direction: 'outflow' },
  buy: { label: 'Compra', direction: 'outflow' },
  fee: { label: 'Comissão', direction: 'outflow' },
  transfer: { label: 'Transferência', direction: 'outflow' },
  adjustment: { label: 'Ajuste', direction: 'inflow' },
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
