export interface T212Instrument {
  ticker: string;
  isin: string | null;
  name: string;
  currencyCode: string;
}

export interface T212Tax {
  name: string;
  quantity: number;
}

export interface T212Order {
  id: number;
  ticker: string;
  filledQuantity: number;
  filledValue: number;
  fillPrice: number;
  taxes?: T212Tax[];
  dateExecuted: string;
}

export interface T212Dividend {
  reference: string;
  ticker: string;
  quantity: number;
  amount: number;
  amountInEuro: number;
  paidOn: string;
}

export interface T212CashTransaction {
  reference: string;
  dateTime: string;
  amount: number;
  type: string;
}

export interface T212Page<T> {
  items: T[];
  nextPagePath: string | null;
}

export type TransactionKind =
  | 'deposit'
  | 'withdrawal'
  | 'expense'
  | 'income'
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'fee'
  | 'interest'
  | 'transfer'
  | 'adjustment';

export interface TransactionRow {
  user_id: string;
  account_id: string;
  instrument_id: string | null;
  kind: TransactionKind;
  amount: number;
  quantity: number | null;
  currency: string;
  fx_rate: number;
  occurred_at: string;
  note: string | null;
  source: 't212_sync';
  external_id: string;
  transfer_group_id: null;
}

export interface InstrumentRow {
  user_id: string;
  ticker: string;
  t212_ticker: string;
  isin: string | null;
  name: string;
  currency: string;
}
