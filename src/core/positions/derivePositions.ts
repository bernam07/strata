import type { Money } from '../money/money';
import { div, money, mul, ratio, subtract, zero } from '../money/money';
import type { Transaction } from '../types';

export interface PriceQuote {
  close: string;
  currency: string;
}

export type PriceLookup = (instrumentId: string) => PriceQuote | null;
export type FxLookup = (currency: string) => string;

export interface Position {
  instrumentId: string;
  provider?: string;
  quantity: Money;
  averageCost: Money;
  costBasis: Money;
  marketValue: Money | null;
  unrealized: Money | null;
  unrealizedPct: number | null;
  dayChange: Money | null;
  dayChangePct: number | null;
}

interface Running {
  quantity: Money;
  averageCost: Money;
}

const applyTransaction = (state: Running, transaction: Transaction): Running => {
  if (transaction.quantity === null) return state;
  const quantity = money(transaction.quantity);
  if (quantity.isZero()) return state;

  if (quantity.isPositive()) {
    const cost = money(transaction.amount).negated();
    const nextQuantity = state.quantity.plus(quantity);
    const prevValue = mul(state.quantity, state.averageCost);
    const averageCost = nextQuantity.isZero()
      ? zero()
      : div(prevValue.plus(cost), nextQuantity);
    return { quantity: nextQuantity, averageCost };
  }

  const nextQuantity = state.quantity.plus(quantity);
  if (nextQuantity.isZero() || nextQuantity.isNegative()) {
    return { quantity: nextQuantity, averageCost: zero() };
  }
  return { quantity: nextQuantity, averageCost: state.averageCost };
};

const byOccurredAt = (a: Transaction, b: Transaction): number =>
  a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0;

export const derivePositions = (
  transactions: readonly Transaction[],
  priceLookup: PriceLookup,
  fxLookup: FxLookup,
): Position[] => {
  const byInstrument = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!transaction.instrumentId || transaction.quantity === null) continue;
    const bucket = byInstrument.get(transaction.instrumentId) ?? [];
    bucket.push(transaction);
    byInstrument.set(transaction.instrumentId, bucket);
  }

  const positions: Position[] = [];
  for (const [instrumentId, entries] of byInstrument) {
    const state = [...entries]
      .sort(byOccurredAt)
      .reduce<Running>(applyTransaction, {
        quantity: zero(),
        averageCost: zero(),
      });

    if (state.quantity.isZero()) continue;

    const costBasis = mul(state.quantity, state.averageCost);
    const quote = priceLookup(instrumentId);
    let marketValue: Money | null = null;
    let unrealized: Money | null = null;
    let unrealizedPct: number | null = null;

    if (quote) {
      const fx = money(fxLookup(quote.currency));
      marketValue = mul(mul(state.quantity, money(quote.close)), fx);
      unrealized = subtract(marketValue, costBasis);
      unrealizedPct = ratio(unrealized, costBasis);
    }

    positions.push({
      instrumentId,
      quantity: state.quantity,
      averageCost: state.averageCost,
      costBasis,
      marketValue,
      unrealized,
      unrealizedPct,
      dayChange: null,
      dayChangePct: null,
    });
  }

  return positions;
};
