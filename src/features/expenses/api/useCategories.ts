import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
}

export const categoriesKey = ['categories'] as const;
export const assignmentsKey = ['category-assignments'] as const;

export const useCategories = () =>
  useQuery<Category[]>({
    queryKey: categoriesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, parent_id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
      }));
    },
  });

export const useCreateCategory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; parentId: string | null }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: input.name,
          parent_id: input.parentId,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: categoriesKey }),
  });
};

export const useUpdateCategory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      parentId?: string | null;
    }) => {
      const patch: { name?: string; parent_id?: string | null } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.parentId !== undefined) patch.parent_id = input.parentId;
      const { error } = await supabase
        .from('categories')
        .update(patch)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: categoriesKey }),
  });
};

export const useDeleteCategory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: categoriesKey });
      client.invalidateQueries({ queryKey: assignmentsKey });
    },
  });
};

export const useAssignments = () =>
  useQuery<Map<string, string>>({
    queryKey: assignmentsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_categories')
        .select('transaction_id, category_id');
      if (error) throw error;
      return new Map(
        (data ?? []).map((row) => [row.transaction_id, row.category_id]),
      );
    },
  });

export const useAssignCategory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transactionId: string;
      categoryId: string | null;
    }) => {
      if (input.categoryId === null) {
        const { error } = await supabase
          .from('transaction_categories')
          .delete()
          .eq('transaction_id', input.transactionId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('transaction_categories')
        .upsert(
          {
            transaction_id: input.transactionId,
            category_id: input.categoryId,
          },
          { onConflict: 'transaction_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: assignmentsKey }),
  });
};
