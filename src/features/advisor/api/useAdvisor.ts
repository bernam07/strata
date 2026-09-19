import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

interface AdvisorResponse {
  answer?: string;
  error?: string;
}

const askAdvisor = async (question: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke<AdvisorResponse>('advisor', {
    body: { question },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.answer) throw new Error('The advisor returned no answer.');
  return data.answer;
};

export const useAskAdvisor = () =>
  useMutation({
    mutationFn: askAdvisor,
  });
