import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface AdvisorSource {
  label: string;
  path: string;
}

export interface AdvisorAnswer {
  answer: string;
  sources: AdvisorSource[];
}

interface AdvisorResponse {
  answer?: string;
  error?: string;
  sources?: AdvisorSource[];
}

const askAdvisor = async (question: string): Promise<AdvisorAnswer> => {
  const { data, error } = await supabase.functions.invoke<AdvisorResponse>('advisor', {
    body: { question },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.answer) throw new Error('The advisor returned no answer.');
  return { answer: data.answer, sources: data.sources ?? [] };
};

export const useAskAdvisor = () =>
  useMutation({
    mutationFn: askAdvisor,
  });
