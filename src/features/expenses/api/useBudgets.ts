import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface Budget {
  categoryId: string;
  limit: string;
}

export const budgetsKey = ['budgets'] as const;

export const useBudgets = () =>
  useQuery<Budget[]>({
    queryKey: budgetsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('category_id, monthly_limit');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        categoryId: row.category_id,
        limit: String(row.monthly_limit),
      }));
    },
  });

export const useSetBudget = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoryId: string; limit: string | null }) => {
      if (input.limit === null) {
        const { error } = await supabase
          .from('budgets')
          .delete()
          .eq('category_id', input.categoryId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('budgets').upsert(
        {
          category_id: input.categoryId,
          monthly_limit: Number(input.limit),
        },
        { onConflict: 'user_id,category_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: budgetsKey }),
  });
};
