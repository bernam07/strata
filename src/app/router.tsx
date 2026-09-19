import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { UpdatePasswordPage } from '@/features/auth/UpdatePasswordPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { AppShell } from './AppShell';
import { useAppUpdate } from './useAppUpdate';

const lazyPage = (
  loader: () => Promise<Record<string, ComponentType>>,
  name: string,
) => lazy(() => loader().then((module) => ({ default: module[name]! })));

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

const PageFallback = () => (
  <p className="text-sm text-[var(--text-muted)]">Loading…</p>
);

export const AppRouter = () => {
  const { session, loading, recovery } = useAuth();
  const { available: updateAvailable, apply: applyUpdate } = useAppUpdate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">
        Loading…
      </div>
    );
  }

  if (recovery) return <UpdatePasswordPage />;
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
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  );
};
