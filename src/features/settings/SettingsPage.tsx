import { useState } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { NotificationsCard } from '@/features/notifications/NotificationsCard';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';

const backupTables = [
  'accounts',
  'transactions',
  'categories',
  'transaction_categories',
  'budgets',
  'price_alerts',
  'watchlist',
  'allocation_targets',
  'instrument_notes',
  'user_preferences',
  'net_worth_snapshots',
] as const;

export const SettingsPage = () => {
  const { session, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [exporting, setExporting] = useState(false);
  const email = session?.user?.email ?? '';

  const exportAll = async () => {
    setExporting(true);
    try {
      const tables: Record<string, unknown[]> = {};
      for (const table of backupTables) {
        const { data } = await supabase.from(table).select('*');
        tables[table] = data ?? [];
      }
      const payload = {
        app: 'strata',
        version: 1,
        exportedAt: new Date().toISOString(),
        email,
        tables,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `strata-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        Settings
      </h1>

      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Account
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">{email}</p>
        </div>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">Theme</p>
          <p className="text-xs text-[var(--text-muted)]">
            Currently {theme === 'dark' ? 'dark' : 'light'}.
          </p>
        </div>
        <Button variant="ghost" onClick={toggle}>
          {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        </Button>
      </Card>

      <NotificationsCard />

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-[var(--text-strong)]">
            Backup your data
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Download everything — accounts, transactions, categories, budgets,
            alerts, watchlist, targets, notes and net-worth history — as a JSON
            file you can keep.
          </p>
        </div>
        <div>
          <Button onClick={exportAll} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export data (JSON)'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
