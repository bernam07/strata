import { useQuery } from '@tanstack/react-query';
import type { Account } from '@/core/types';
import type { BalanceByAccount } from '@/core/balances/deriveBalances';
import { money } from '@/core/money/money';
import { supabase } from '@/db/supabase';

import { getLocalXtbState } from '@/features/integrations/api/useXtb';

export interface BrokerSnapshot {
  free: string;
  invested: string;
  ppl: string;
  total: string;
}

export const providerByInstitution: Record<string, string> = {
  trading212: 't212',
  xtb: 'xtb',
};

export const useBrokerAccounts = () =>
  useQuery<Map<string, BrokerSnapshot>>({
    queryKey: ['broker-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('broker_accounts')
        .select('provider, free, invested, ppl, total');
      if (error) throw error;
      const map = new Map<string, BrokerSnapshot>(
        (data ?? []).map((row) => {
          const authoritativeTotal =
            Number(row.free) + Number(row.invested) + Number(row.ppl);
          const storedTotal = Number(row.total);
          const isCorruptedTotal =
            authoritativeTotal > 0 &&
            Math.abs(storedTotal - authoritativeTotal) / authoritativeTotal > 0.25;
          return [
            row.provider,
            isCorruptedTotal
              ? { ...row, total: authoritativeTotal.toFixed(4) }
              : row,
          ];
        }),
      );
      const localXtb = getLocalXtbState();
      if (localXtb && !map.has('xtb')) {
        map.set('xtb', {
          free: localXtb.freeCash.toFixed(4),
          invested: localXtb.invested.toFixed(4),
          ppl: localXtb.ppl.toFixed(4),
          total: localXtb.total.toFixed(4),
        });
      }
      return map;
    },
  });

export const applyBrokerBalances = (
  balances: BalanceByAccount,
  accounts: readonly Account[],
  brokers: Map<string, BrokerSnapshot>,
): BalanceByAccount => {
  const merged = new Map(balances);
  for (const account of accounts) {
    const provider = providerByInstitution[account.institutionId];
    const snapshot = provider ? brokers.get(provider) : undefined;
    if (snapshot) merged.set(account.id, money(snapshot.total));
  }
  return merged;
};
