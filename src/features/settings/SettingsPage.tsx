import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { setPrivacy, usePrivacy } from '@/ui/privacy';
import { toast } from '@/ui/toast';
import { NotificationsCard } from '@/features/notifications/NotificationsCard';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { CardTitle } from '@/ui/Heading';

interface RestoreTable {
  table: string;
  conflict: string;
  parentsFirst?: boolean;
}

// Only config the user authors and that doesn't depend on the synced ledger
// (accounts/instruments). Restoring these is safe and idempotent.
const restoreTables: RestoreTable[] = [
  { table: 'categories', conflict: 'id', parentsFirst: true },
  { table: 'budgets', conflict: 'user_id,category_id' },
  { table: 'price_alerts', conflict: 'id' },
  { table: 'watchlist', conflict: 'user_id,symbol' },
  { table: 'user_preferences', conflict: 'user_id' },
  { table: 'crypto_holdings', conflict: 'user_id,symbol' },
];

const stripMeta = (row: Record<string, unknown>): Record<string, unknown> => {
  const { user_id, created_at, updated_at, added_at, ...rest } = row;
  void user_id;
  void created_at;
  void updated_at;
  void added_at;
  return rest;
};

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
  const privacyOn = usePrivacy();
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const email = session?.user?.email ?? '';

  const restore = async (file: File) => {
    setRestoreStatus('Restoring…');
    try {
      const parsed = JSON.parse(await file.text());
      const tables: Record<string, Record<string, unknown>[]> =
        parsed.tables ?? parsed;
      const db = supabase as unknown as {
        from: (table: string) => {
          upsert: (
            rows: unknown,
            opts: { onConflict: string },
          ) => Promise<{ error: unknown }>;
        };
      };
      let restored = 0;
      const failed: string[] = [];
      for (const { table, conflict, parentsFirst } of restoreTables) {
        let rows = (tables[table] ?? []).map(stripMeta);
        if (rows.length === 0) continue;
        if (parentsFirst) {
          rows = rows.sort(
            (a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0),
          );
        }
        const { error } = await db.from(table).upsert(rows, {
          onConflict: conflict,
        });
        if (error) failed.push(table);
        else restored += rows.length;
      }
      await client.invalidateQueries();
      setRestoreStatus(
        failed.length > 0
          ? `Restored ${restored} rows. Skipped: ${failed.join(', ')}.`
          : `Restored ${restored} rows.`,
      );
    } catch {
      setRestoreStatus('Could not read that file.');
    }
  };

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
      toast('Backup downloaded', 'success');
    } catch {
      toast("Couldn't export your data", 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Settings" subtitle="Preferences, privacy and backups." />

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

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Hide amounts
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Blur every balance and value across the app. Toggle anytime with
            ⌘K → “Hide amounts”.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setPrivacy(!privacyOn)}>
          {privacyOn ? 'Show' : 'Hide'}
        </Button>
      </Card>

      <NotificationsCard />

      <Card className="flex flex-col gap-3">
        <div>
          <CardTitle>
            Backup your data
          </CardTitle>
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

      <Card className="flex flex-col gap-3">
        <div>
          <CardTitle>
            Restore from a backup
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Restores your categories, budgets, watchlist, price alerts, crypto
            and preferences from a backup file. The synced ledger (accounts and
            transactions) isn't touched — it re-syncs from Trading 212.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restore(file);
              event.target.value = '';
            }}
          />
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Choose backup file
          </Button>
        </div>
        {restoreStatus && (
          <p className="text-xs text-[var(--text-muted)]">{restoreStatus}</p>
        )}
      </Card>
    </div>
  );
};
