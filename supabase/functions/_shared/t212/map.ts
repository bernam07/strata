import { round4, round8 } from './normalize.ts';
import type {
  InstrumentRow,
  T212CashTransaction,
  T212Dividend,
  T212Instrument,
  T212Order,
  TransactionKind,
  TransactionRow,
} from './types.ts';

export type InstrumentResolver = (t212Ticker: string) => string | null;

export const toInstrumentRow = (
  userId: string,
  instrument: T212Instrument,
): InstrumentRow => ({
  user_id: userId,
  ticker: instrument.ticker.split('_')[0] ?? instrument.ticker,
  t212_ticker: instrument.ticker,
  isin: instrument.isin,
  name: instrument.name,
  currency: instrument.currencyCode.slice(0, 3).toUpperCase() || 'EUR',
});

const totalTaxes = (order: T212Order): number =>
  (order.taxes ?? []).reduce((sum, tax) => sum + (tax.quantity ?? 0), 0);

export const orderToTransactionRow = (
  userId: string,
  accountId: string,
  order: T212Order,
  resolveInstrument: InstrumentResolver,
): TransactionRow => {
  const filledQuantity = order.filledQuantity ?? 0;
  const isBuy = filledQuantity >= 0;
  const value = Math.abs(order.filledValue ?? 0);
  const taxes = totalTaxes(order);
  const amount = isBuy ? -(value + taxes) : value - taxes;
  return {
    user_id: userId,
    account_id: accountId,
    instrument_id: resolveInstrument(order.ticker),
    kind: isBuy ? 'buy' : 'sell',
    amount: round4(amount),
    quantity: round8(filledQuantity),
    currency: 'EUR',
    fx_rate: 1,
    occurred_at: order.dateExecuted,
    note: null,
    source: 't212_sync',
    external_id: `order:${order.id}`,
    transfer_group_id: null,
  };
};

export const dividendToTransactionRow = (
  userId: string,
  accountId: string,
  dividend: T212Dividend,
  resolveInstrument: InstrumentResolver,
): TransactionRow => {
  const gross = Math.abs(dividend.amount);
  const inEuro = Math.abs(dividend.amountInEuro);
  return {
    user_id: userId,
    account_id: accountId,
    instrument_id: resolveInstrument(dividend.ticker),
    kind: 'dividend',
    amount: round4(inEuro),
    quantity: null,
    currency: 'EUR',
    fx_rate: gross > 0 ? round8(inEuro / gross) : 1,
    occurred_at: dividend.paidOn,
    note: 'Dividendo',
    source: 't212_sync',
    external_id: `dividend:${dividend.reference}`,
    transfer_group_id: null,
  };
};

const cashKind: Record<string, TransactionKind> = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdrawal',
  WITHDRAWAL: 'withdrawal',
  INTEREST: 'interest',
  FEE: 'fee',
};

export const cashTransactionToRow = (
  userId: string,
  accountId: string,
  cash: T212CashTransaction,
): TransactionRow => {
  const kind = cashKind[cash.type.toUpperCase()] ?? 'adjustment';
  return {
    user_id: userId,
    account_id: accountId,
    instrument_id: null,
    kind,
    amount: round4(cash.amount),
    quantity: null,
    currency: 'EUR',
    fx_rate: 1,
    occurred_at: cash.dateTime,
    note: cash.type,
    source: 't212_sync',
    external_id: `cash:${cash.reference}`,
    transfer_group_id: null,
  };
};
