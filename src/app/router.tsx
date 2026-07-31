import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { IntegrationsPage } from '@/features/integrations/IntegrationsPage';
import { PositionsPage } from '@/features/positions/PositionsPage';
import { DividendsPage } from '@/features/dividends/DividendsPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { TaxPage } from '@/features/tax/TaxPage';
import { AppShell } from './AppShell';

const AnalyticsPage = lazy(() =>
  import('@/features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);

export const AppRouter = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">
        Loading…
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/positions" element={<PositionsPage />} />
          <Route path="/dividends" element={<DividendsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/tax" element={<TaxPage />} />
          <Route
            path="/analytics"
            element={
              <Suspense
                fallback={
                  <p className="text-sm text-[var(--text-muted)]">Loading…</p>
                }
              >
                <AnalyticsPage />
              </Suspense>
            }
          />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
};
