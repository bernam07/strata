import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, AccountType } from '@/core/types';
import { supabase } from '@/db/supabase';
import { toAccount } from '@/db/mappers';

export const accountsKey = ['accounts'] as const;

export const useAccounts = () =>
  useQuery<Account[]>({
    queryKey: accountsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data.map(toAccount);
    },
  });

export interface NewAccount {
  name: string;
  type: AccountType;
  institutionId: string;
}

export const useCreateAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewAccount) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          name: input.name,
          type: input.type,
          institution_id: input.institutionId,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toAccount(data);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useRenameAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update({ name: input.name })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: accountsKey }),
  });
};

export const useDeleteAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: accountsKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
      client.invalidateQueries({ queryKey: ['positions'] });
    },
  });
};
