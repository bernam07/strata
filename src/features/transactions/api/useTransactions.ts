import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction, TransactionKind } from '@/core/types';
import { supabase } from '@/db/supabase';
import { toTransaction } from '@/db/mappers';

export interface TransactionFilter {
  accountId?: string;
  from?: string;
  to?: string;
}

export const transactionsKey = (filter: TransactionFilter) =>
  ['transactions', filter] as const;

export const useTransactions = (filter: TransactionFilter = {}) =>
  useQuery<Transaction[]>({
    queryKey: transactionsKey(filter),
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('occurred_at', { ascending: false });

      if (filter.accountId) query = query.eq('account_id', filter.accountId);
      if (filter.from) query = query.gte('occurred_at', filter.from);
      if (filter.to) query = query.lte('occurred_at', filter.to);

      const { data, error } = await query;
      if (error) throw error;
      return data.map(toTransaction);
    },
  });

export interface NewTransaction {
  accountId: string;
  kind: TransactionKind;
  amount: string;
  occurredAt: string;
  note: string | null;
}

export const useCreateTransaction = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTransaction) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          account_id: input.accountId,
          kind: input.kind,
          amount: input.amount,
          occurred_at: input.occurredAt,
          note: input.note,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toTransaction(data);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
