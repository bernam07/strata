import type { Money } from '../money/money';
import { div, money, mul, subtract, zero } from '../money/money';
import type { Transaction } from '../types';

export interface Disposal {
  instrumentId: string;
  quantity: Money;
  acquiredAt: string;
  disposedAt: string;
  cost: Money;
  proceeds: Money;
  gain: Money;
}

interface Lot {
  quantity: Money;
  unitCost: Money;
  acquiredAt: string;
}

const byOccurredAt = (a: Transaction, b: Transaction): number =>
  a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0;

const disposeAgainstLots = (
  instrumentId: string,
  lots: Lot[],
  quantityToSell: Money,
  proceedsPerShare: Money,
  disposedAt: string,
): Disposal[] => {
  const disposals: Disposal[] = [];
  let remaining = quantityToSell;

  while (remaining.greaterThan(0) && lots.length > 0) {
    const lot = lots[0]!;
    const matched = lot.quantity.lessThanOrEqualTo(remaining)
      ? lot.quantity
      : remaining;

    const cost = mul(matched, lot.unitCost);
    const proceeds = mul(matched, proceedsPerShare);
    disposals.push({
      instrumentId,
      quantity: matched,
      acquiredAt: lot.acquiredAt,
      disposedAt,
      cost,
      proceeds,
      gain: subtract(proceeds, cost),
    });

    remaining = subtract(remaining, matched);
    lot.quantity = subtract(lot.quantity, matched);
    if (lot.quantity.lessThanOrEqualTo(0)) lots.shift();
  }

  return disposals;
};

export const realizedDisposals = (
  transactions: readonly Transaction[],
): Disposal[] => {
  const byInstrument = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!transaction.instrumentId || transaction.quantity === null) continue;
    const bucket = byInstrument.get(transaction.instrumentId) ?? [];
    bucket.push(transaction);
    byInstrument.set(transaction.instrumentId, bucket);
  }

  const disposals: Disposal[] = [];
  for (const [instrumentId, entries] of byInstrument) {
    const lots: Lot[] = [];
    for (const transaction of [...entries].sort(byOccurredAt)) {
      const quantity = money(transaction.quantity!);
      if (quantity.isZero()) continue;

      if (quantity.isPositive()) {
        lots.push({
          quantity,
          unitCost: div(money(transaction.amount).negated(), quantity),
          acquiredAt: transaction.occurredAt,
        });
      } else {
        const soldQuantity = quantity.negated();
        disposals.push(
          ...disposeAgainstLots(
            instrumentId,
            lots,
            soldQuantity,
            div(money(transaction.amount), soldQuantity),
            transaction.occurredAt,
          ),
        );
      }
    }
  }

  return disposals;
};

export interface YearlyGains {
  year: number;
  proceeds: Money;
  cost: Money;
  gain: Money;
  disposals: Disposal[];
}

export const realizedGainsByYear = (
  transactions: readonly Transaction[],
): YearlyGains[] => {
  const disposals = realizedDisposals(transactions);
  const byYear = new Map<number, Disposal[]>();
  for (const disposal of disposals) {
    const year = new Date(disposal.disposedAt).getUTCFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(disposal);
    byYear.set(year, bucket);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, rows]) => ({
      year,
      proceeds: rows.reduce((total, row) => total.plus(row.proceeds), zero()),
      cost: rows.reduce((total, row) => total.plus(row.cost), zero()),
      gain: rows.reduce((total, row) => total.plus(row.gain), zero()),
      disposals: rows,
    }));
};
