import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: 1,
    },
  },
});

export const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);
