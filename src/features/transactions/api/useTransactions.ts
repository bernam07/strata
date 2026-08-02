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

export interface NewTransfer {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  occurredAt: string;
  note: string | null;
}

export const useCreateTransfer = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTransfer) => {
      const groupId = crypto.randomUUID();
      const magnitude = Math.abs(Number(input.amount)).toFixed(4);
      const { error } = await supabase.from('transactions').insert([
        {
          account_id: input.fromAccountId,
          kind: 'transfer',
          amount: `-${magnitude}`,
          occurred_at: input.occurredAt,
          note: input.note,
          transfer_group_id: groupId,
        },
        {
          account_id: input.toAccountId,
          kind: 'transfer',
          amount: magnitude,
          occurred_at: input.occurredAt,
          note: input.note,
          transfer_group_id: groupId,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
};

export interface EditTransaction {
  id: string;
  kind: TransactionKind;
  amount: string;
  occurredAt: string;
  note: string | null;
}

export const useUpdateTransaction = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: EditTransaction) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          kind: input.kind,
          amount: input.amount,
          occurred_at: input.occurredAt,
          note: input.note,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
};

export const useReverseTransaction = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (transaction: Transaction) => {
      const reversedAmount = (-Number(transaction.amount)).toFixed(4);
      const { error } = await supabase.from('transactions').insert({
        account_id: transaction.accountId,
        kind: 'adjustment',
        amount: reversedAmount,
        occurred_at: new Date().toISOString(),
        note: `Reversal: ${transaction.note ?? transaction.kind}`,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
};
