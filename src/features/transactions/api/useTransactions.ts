import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction, TransactionKind } from '@/core/types';
import { supabase } from '@/db/supabase';
import { toTransaction, type TransactionRow } from '@/db/mappers';

export interface TransactionFilter {
  accountId?: string;
  instrumentId?: string;
  from?: string;
  to?: string;
}

export const transactionsKey = (filter: TransactionFilter) =>
  ['transactions', filter] as const;

const PAGE = 1000;

export const useTransactions = (filter: TransactionFilter = {}) =>
  useQuery<Transaction[]>({
    queryKey: transactionsKey(filter),
    queryFn: async () => {
      // Supabase caps a single select at 1000 rows. An active account can
      // have far more trades than that, and the newest 1000 could all fall in
      // the current year — so page through everything, or years of history
      // silently vanish from the ledger-derived views.
      const rows: TransactionRow[] = [];
      for (let offset = 0; ; offset += PAGE) {
        let query = supabase
          .from('transactions')
          .select('*')
          .order('occurred_at', { ascending: false })
          .range(offset, offset + PAGE - 1);

        if (filter.accountId) query = query.eq('account_id', filter.accountId);
        if (filter.instrumentId)
          query = query.eq('instrument_id', filter.instrumentId);
        if (filter.from) query = query.gte('occurred_at', filter.from);
        if (filter.to) query = query.lte('occurred_at', filter.to);

        const { data, error } = await query;
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      return rows.map(toTransaction);
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

export const useDeleteTransaction = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Drop any category assignment first, then the transaction itself.
      await supabase
        .from('transaction_categories')
        .delete()
        .eq('transaction_id', id);
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['category-assignments'] });
    },
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
