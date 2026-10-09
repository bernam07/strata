import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AppShell } from './AppShell';
import { useAppUpdate } from './useAppUpdate';

const lazyPage = (
  loader: () => Promise<Record<string, ComponentType>>,
  name: string,
) => lazy(() => loader().then((module) => ({ default: module[name]! })));

const UpdatePasswordPage = lazyPage(
  () => import('@/features/auth/UpdatePasswordPage'),
  'UpdatePasswordPage',
);
const AccountsPage = lazyPage(
  () => import('@/features/accounts/AccountsPage'),
  'AccountsPage',
);
const AccountDetailPage = lazyPage(
  () => import('@/features/accounts/AccountDetailPage'),
  'AccountDetailPage',
);
const TransactionsPage = lazyPage(
  () => import('@/features/transactions/TransactionsPage'),
  'TransactionsPage',
);
const PositionsPage = lazyPage(
  () => import('@/features/positions/PositionsPage'),
  'PositionsPage',
);
const InstrumentDetailPage = lazyPage(
  () => import('@/features/positions/InstrumentDetailPage'),
  'InstrumentDetailPage',
);
const SearchPage = lazyPage(() => import('@/features/search/SearchPage'), 'SearchPage');
const DividendsPage = lazyPage(
  () => import('@/features/dividends/DividendsPage'),
  'DividendsPage',
);
const ExpensesPage = lazyPage(
  () => import('@/features/expenses/ExpensesPage'),
  'ExpensesPage',
);
const IntegrationsPage = lazyPage(
  () => import('@/features/integrations/IntegrationsPage'),
  'IntegrationsPage',
);
const SettingsPage = lazyPage(
  () => import('@/features/settings/SettingsPage'),
  'SettingsPage',
);
const CryptoPage = lazyPage(() => import('@/features/crypto/CryptoPage'), 'CryptoPage');
const CollectiblesPage = lazyPage(
  () => import('@/features/collectibles/CollectiblesPage'),
  'CollectiblesPage',
);

export const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/accounts': () => import('@/features/accounts/AccountsPage'),
  '/transactions': () => import('@/features/transactions/TransactionsPage'),
  '/positions': () => import('@/features/positions/PositionsPage'),
  '/collectibles': () => import('@/features/collectibles/CollectiblesPage'),
  '/expenses': () => import('@/features/expenses/ExpensesPage'),
  '/dividends': () => import('@/features/dividends/DividendsPage'),
  '/crypto': () => import('@/features/crypto/CryptoPage'),
  '/search': () => import('@/features/search/SearchPage'),
  '/settings': () => import('@/features/settings/SettingsPage'),
  '/integrations': () => import('@/features/integrations/IntegrationsPage'),
};

export const preloadRoute = (path: string): void => {
  const [firstPart] = path.split('?');
  const clean = (firstPart ?? '').split('#')[0] ?? '';
  const target = Object.keys(routeLoaders).find((route) => clean.startsWith(route));
  if (target) {
    const loader = routeLoaders[target];
    if (loader) {
      void loader();
    }
  }
};

export const preloadCoreRoutes = (): void => {
  const priority = ['/accounts', '/transactions', '/positions', '/collectibles', '/expenses'];
  const runner = () => {
    for (const p of priority) {
      void routeLoaders[p]?.();
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(runner, { timeout: 2000 });
  } else {
    setTimeout(runner, 250);
  }
};

import { isSupabaseConfigured } from '@/db/supabase';

const PageFallback = () => (
  <p className="text-sm text-[var(--text-muted)]">Loading…</p>
);

export const AppRouter = () => {
  const { session, loading, recovery } = useAuth();
  const { available: updateAvailable, apply: applyUpdate } = useAppUpdate();

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center bg-[var(--bg)] text-[var(--text-strong)]">
        <div className="max-w-sm rounded-[var(--radius-card)] border border-[var(--negative)]/40 bg-[var(--surface-raised)] p-6 shadow-2xl">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--negative)_16%,transparent)] text-xl text-[var(--negative)]">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-[var(--text-strong)]">Configuração em falta</h2>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-2)]">
            As variáveis <code className="text-[var(--accent)] font-semibold">VITE_SUPABASE_URL</code> e{' '}
            <code className="text-[var(--accent)] font-semibold">VITE_SUPABASE_ANON_KEY</code> não estavam no ficheiro{' '}
            <code className="text-[var(--accent)] font-semibold">.env</code> quando este APK foi gerado.
          </p>
          <div className="mt-4 rounded-[var(--radius-field)] bg-[var(--surface-sunken)] p-3 text-left text-[11px] text-[var(--text-muted)] font-mono leading-5">
            1. Cria o ficheiro .env no PC<br />
            2. Adiciona as chaves do Supabase<br />
            3. Corre <strong>npm run cap:sync</strong><br />
            4. Reinstala o APK no Xiaomi
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">
        Loading…
      </div>
    );
  }

  if (recovery) {
    return (
      <Suspense fallback={<PageFallback />}>
        <UpdatePasswordPage />
      </Suspense>
    );
  }
  if (!session) return <LoginPage />;

  return (
    <BrowserRouter>
      {updateAvailable && (
        <div className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-sm shadow-[var(--shadow)]">
          <span className="text-[var(--text-2)]">Nova versão disponível.</span>
          <button
            type="button"
            onClick={applyUpdate}
            className="tap shrink-0 rounded-[var(--radius-field)] bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)]"
          >
            Atualizar
          </button>
        </div>
      )}
      <AppShell>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/positions" element={<PositionsPage />} />
            <Route path="/positions/:id" element={<InstrumentDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/dividends" element={<DividendsPage />} />
            <Route path="/crypto" element={<CryptoPage />} />
            <Route path="/collectibles" element={<CollectiblesPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  );
};
