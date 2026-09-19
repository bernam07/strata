import { useEffect, useRef, useState } from 'react';
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

interface BackupPayload {
  app: 'strata';
  version: 1;
  exportedAt: string;
  email?: string;
  tables: Record<string, Record<string, unknown>[]>;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseBackup = (value: unknown): BackupPayload | null => {
  if (!isRecord(value)) return null;
  if (value.app !== 'strata' || value.version !== 1 || !isRecord(value.tables)) {
    return null;
  }

  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const [table, rows] of Object.entries(value.tables)) {
    if (!Array.isArray(rows) || !rows.every(isRecord)) return null;
    tables[table] = rows;
  }

  if (
    typeof value.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(value.exportedAt))
  ) {
    return null;
  }
  return {
    app: 'strata',
    version: 1,
    exportedAt: value.exportedAt,
    email: typeof value.email === 'string' ? value.email : undefined,
    tables,
  };
};

const restoreCount = (payload: BackupPayload): number =>
  restoreTables.reduce((total, { table }) => total + (payload.tables[table]?.length ?? 0), 0);

export const SettingsPage = () => {
  const { session, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const privacyOn = usePrivacy();
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  );
  const [pendingRestore, setPendingRestore] = useState<BackupPayload | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const email = session?.user?.email ?? '';

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const prepareRestore = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setRestoreStatus('That backup is too large. Choose a file under 10 MB.');
      return;
    }
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (!parsed) {
        setRestoreStatus('That file is not a valid Strata backup.');
        return;
      }
      setPendingRestore(parsed);
      setRestoreStatus(null);
    } catch {
      setRestoreStatus('Could not read that file.');
    }
  };

  const restore = async (payload: BackupPayload) => {
    setRestoreStatus('Restoring…');
    try {
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
        let rows = (payload.tables[table] ?? []).map(stripMeta);
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
      setPendingRestore(null);
      setRestoreStatus(
        failed.length > 0
          ? `Restored ${restored} rows. Skipped: ${failed.join(', ')}.`
          : `Restored ${restored} rows.`,
      );
    } catch {
      setRestoreStatus('Could not restore that backup.');
    }
  };

  const exportAll = async () => {
    if (!online) {
      toast('Connect to the internet before exporting', 'error');
      return;
    }
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
          <Button onClick={exportAll} disabled={exporting || !online}>
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
              if (file) void prepareRestore(file);
              event.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            disabled={!online}
            onClick={() => fileRef.current?.click()}
          >
            Choose backup file
          </Button>
        </div>
        {pendingRestore && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-field)] bg-[var(--surface-sunken)] p-3">
            <p className="text-xs text-[var(--text-2)]">
              Ready to restore {restoreCount(pendingRestore)} rows from{' '}
              {new Date(pendingRestore.exportedAt).toLocaleDateString()}.
              Existing matching settings will be replaced.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void restore(pendingRestore)}>
                Confirm restore
              </Button>
              <Button variant="ghost" onClick={() => setPendingRestore(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {restoreStatus && (
          <p className="text-xs text-[var(--text-muted)]">{restoreStatus}</p>
        )}
      </Card>
    </div>
  );
};
