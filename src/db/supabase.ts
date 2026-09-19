import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const guardedFetch: typeof fetch = async (input, init) => {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine &&
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    throw new Error('OFFLINE_WRITE');
  }
  return fetch(input, init);
};

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  global: { fetch: guardedFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
