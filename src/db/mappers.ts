import type { Account, Transaction } from '@/core/types';
import type { Database } from './database.types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
export type TransactionRow = Database['public']['Tables']['transactions']['Row'];

export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  institutionId: row.institution_id,
  name: row.name,
  type: row.type,
  currency: row.currency,
  createdAt: row.created_at,
  archivedAt: row.archived_at,
});

export const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  accountId: row.account_id,
  kind: row.kind,
  amount: row.amount,
  quantity: row.quantity,
  currency: row.currency,
  fxRate: row.fx_rate,
  occurredAt: row.occurred_at,
  note: row.note,
  source: row.source,
  externalId: row.external_id,
  transferGroupId: row.transfer_group_id,
  instrumentId: row.instrument_id,
  createdAt: row.created_at,
});
