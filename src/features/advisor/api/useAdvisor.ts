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
  if (error) {
    let message = error.message;
    if (error && typeof error === 'object' && 'context' in error) {
      try {
        const res = (error as { context: Response }).context;
        if (res && typeof res.json === 'function') {
          const body = await res.json();
          if (body?.error && typeof body.error === 'string') {
            message = body.error;
          }
        }
      } catch {
        // Fall back to original error message
      }
    }
    if (message.toLowerCase().includes('non-2xx')) {
      throw new Error('Advisor is not deployed or is not configured yet.');
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.answer) throw new Error('The advisor returned no answer.');
  return { answer: data.answer, sources: data.sources ?? [] };
};

export const useAskAdvisor = () =>
  useMutation({
    mutationFn: askAdvisor,
  });
