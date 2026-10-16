import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Account, AccountType } from '@/core/types';
import { supabase } from '@/db/supabase';
import { setAccountInstitutionOverride, toAccount } from '@/db/mappers';

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
      const attemptInsert = (instId: string) =>
        supabase
          .from('accounts')
          .insert({
            name: input.name,
            type: input.type,
            institution_id: instId,
          })
          .select('*')
          .single();

      let { data, error } = await attemptInsert(input.institutionId);
      if (error && error.code === '23503') {
        await supabase.functions
          .invoke('market', { body: { action: 'ensure-institutions' } })
          .catch(() => undefined);
        const retry = await attemptInsert(input.institutionId);
        data = retry.data;
        error = retry.error;
        if (error && error.code === '23503') {
          const fallback = await attemptInsert('trade_republic');
          data = fallback.data;
          error = fallback.error;
          if (data) {
            setAccountInstitutionOverride(data.id, input.institutionId);
          }
        }
      }
      if (error || !data) throw error ?? new Error('Failed to create account');
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
