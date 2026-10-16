import type { Account, Transaction } from '@/core/types';
import type { Database } from './database.types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
export type TransactionRow = Database['public']['Tables']['transactions']['Row'];

const INSTITUTION_OVERRIDES_KEY = 'strata_account_institution_overrides_v1';

export const getAccountInstitutionOverrides = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(INSTITUTION_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export const setAccountInstitutionOverride = (
  accountId: string,
  institutionId: string,
): void => {
  if (typeof window === 'undefined') return;
  try {
    const map = getAccountInstitutionOverrides();
    map[accountId] = institutionId;
    window.localStorage.setItem(INSTITUTION_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
};

export const toAccount = (row: AccountRow): Account => {
  const overrides = getAccountInstitutionOverrides();
  const inferredInstitution =
    overrides[row.id] ??
    (row.name.trim().toUpperCase().startsWith('XTB') ? 'xtb' : row.institution_id);
  return {
    id: row.id,
    institutionId: inferredInstitution,
    name: row.name,
    type: row.type,
    currency: row.currency,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
};

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
