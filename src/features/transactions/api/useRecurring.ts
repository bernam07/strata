import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransactionKind } from '@/core/types';
import { signedAmount } from '@/core/transactions/kinds';
import { money } from '@/core/money/money';
import { dueOccurrences, type Cadence } from '@/core/recurring/schedule';
import { supabase } from '@/db/supabase';

export interface RecurringRule {
  id: string;
  accountId: string;
  kind: TransactionKind;
  amount: string;
  note: string | null;
  categoryId: string | null;
  cadence: Cadence;
  nextRun: string;
  active: boolean;
}

export const recurringKey = ['recurring'] as const;

export const useRecurring = () =>
  useQuery<RecurringRule[]>({
    queryKey: recurringKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('id, account_id, kind, amount, note, category_id, cadence, next_run, active')
        .order('next_run', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        accountId: row.account_id,
        kind: row.kind as TransactionKind,
        amount: String(row.amount),
        note: row.note,
        categoryId: row.category_id,
        cadence: row.cadence as Cadence,
        nextRun: row.next_run,
        active: row.active,
      }));
    },
  });

export interface NewRecurring {
  accountId: string;
  kind: TransactionKind;
  amount: string;
  note: string | null;
  categoryId: string | null;
  cadence: Cadence;
  nextRun: string;
}

export const useCreateRecurring = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewRecurring) => {
      const { error } = await supabase.from('recurring_transactions').insert({
        account_id: input.accountId,
        kind: input.kind,
        amount: Number(input.amount),
        note: input.note,
        category_id: input.categoryId,
        cadence: input.cadence,
        next_run: input.nextRun,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: recurringKey }),
  });
};

export const useDeleteRecurring = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: recurringKey }),
  });
};

export interface UpdateRecurringInput extends NewRecurring {
  id: string;
  active?: boolean;
}

export const useUpdateRecurring = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRecurringInput) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({
          account_id: input.accountId,
          kind: input.kind,
          amount: Number(input.amount),
          note: input.note,
          category_id: input.categoryId,
          cadence: input.cadence,
          next_run: input.nextRun,
          ...(input.active !== undefined ? { active: input.active } : {}),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: recurringKey }),
  });
};

export const useToggleRecurring = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: recurringKey }),
  });
};

export interface RecurringMetrics {
  monthlyFixedOutflow: number;
  yearlyFixedOutflow: number;
  dueBeforePayday: number;
  dueBeforePaydayCount: number;
}

const monthlyMultiplier: Record<Cadence, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export const computeRecurringMetrics = (
  rules: readonly RecurringRule[],
  cycleEndIso: string,
): RecurringMetrics => {
  let monthlyFixedOutflow = 0;
  let dueBeforePayday = 0;
  let dueBeforePaydayCount = 0;

  for (const rule of rules) {
    if (!rule.active) continue;
    const isOutflow = rule.kind === 'expense' || rule.kind === 'fee';
    if (!isOutflow) continue;

    const amt = Math.abs(Number(rule.amount)) || 0;
    if (amt <= 0) continue;

    monthlyFixedOutflow += amt * (monthlyMultiplier[rule.cadence] ?? 1);

    if (rule.nextRun <= cycleEndIso) {
      const { dates } = dueOccurrences(rule.nextRun, cycleEndIso, rule.cadence);
      const count = Math.max(1, dates.length);
      dueBeforePayday += amt * count;
      dueBeforePaydayCount += count;
    }
  }

  return {
    monthlyFixedOutflow,
    yearlyFixedOutflow: monthlyFixedOutflow * 12,
    dueBeforePayday,
    dueBeforePaydayCount,
  };
};

// Posts any missed occurrences up to today and advances next_run. Safe to run
// on every app load: once processed, next_run moves past today.
export const processRecurring = async (): Promise<number> => {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rules, error } = await supabase
    .from('recurring_transactions')
    .select('id, account_id, kind, amount, note, category_id, cadence, next_run')
    .eq('active', true)
    .lte('next_run', today);
  if (error || !rules || rules.length === 0) return 0;

  let posted = 0;
  for (const rule of rules) {
    const { dates, nextRun } = dueOccurrences(
      rule.next_run,
      today,
      rule.cadence as Cadence,
    );
    for (const date of dates) {
      const amount = signedAmount(
        rule.kind as TransactionKind,
        money(rule.amount),
      ).toFixed(4);
      const { data: created } = await supabase
        .from('transactions')
        .insert({
          account_id: rule.account_id,
          kind: rule.kind as TransactionKind,
          amount,
          occurred_at: `${date}T12:00:00.000Z`,
          note: rule.note,
        })
        .select('id')
        .single();
      if (created && rule.category_id) {
        await supabase
          .from('transaction_categories')
          .upsert(
            { transaction_id: created.id, category_id: rule.category_id },
            { onConflict: 'transaction_id' },
          );
      }
      posted += 1;
    }
    await supabase
      .from('recurring_transactions')
      .update({ next_run: nextRun })
      .eq('id', rule.id);
  }
  return posted;
};

export const useProcessRecurring = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: processRecurring,
    onSuccess: (posted) => {
      if (posted > 0) {
        client.invalidateQueries({ queryKey: ['transactions'] });
        client.invalidateQueries({ queryKey: recurringKey });
      }
    },
  });
};
