export type AccountType = 'investment' | 'cash' | 'liability';

export type TransactionSource = 'manual' | 't212_sync' | 'csv_import';

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

export interface Account {
  id: string;
  institutionId: string;
  name: string;
  type: AccountType;
  currency: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  kind: TransactionKind;
  amount: string;
  quantity: string | null;
  currency: string;
  fxRate: string;
  occurredAt: string;
  note: string | null;
  source: TransactionSource;
  externalId: string | null;
  transferGroupId: string | null;
  instrumentId: string | null;
  createdAt: string;
}
