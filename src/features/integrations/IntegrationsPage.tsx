import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { Surface } from '@/ui/Surface';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import { NotificationsCard } from '@/features/notifications/NotificationsCard';
import {
  useClearSyncHistory,
  useRemoveT212Key,
  useResetSync,
  useRunSync,
  useSetT212Key,
  useSyncRuns,
  useT212Connection,
} from './api/useT212';
import { SyncRunList } from './SyncRunList';
import { WidgetCard } from './WidgetCard';
import { CardTitle } from '@/ui/Heading';

export const IntegrationsPage = () => {
  const connection = useT212Connection();
  const setKey = useSetT212Key();
  const removeKey = useRemoveT212Key();
  const runSync = useRunSync();
  const runs = useSyncRuns();
  const clearHistory = useClearSyncHistory();
  const resetSync = useResetSync();

  const [key, setKey_] = useState('');
  const [secret, setSecret] = useState('');
  const [useDemo, setUseDemo] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim() || !secret.trim()) return;
    setKey.mutate(
      { key: key.trim(), secret: secret.trim(), useDemo },
      {
        onSuccess: () => {
          setKey_('');
          setSecret('');
        },
      },
    );
  };

  const connected = connection.data !== null && connection.data !== undefined;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Integrations"
        subtitle="Connect Trading 212 and set up your iPhone widget."
      />

      <NotificationsCard />

      <Card className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <InstitutionLogo institutionId="trading212" />
          <div className="flex-1">
            <p className="font-semibold text-[var(--text-strong)]">
              Trading 212
            </p>
            {connected ? (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--positive)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                Connected · {connection.data?.useDemo ? 'demo' : 'live'}
              </span>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Not connected</p>
            )}
          </div>
          {connected && (
            <Button
              variant="ghost"
              disabled={removeKey.isPending}
              onClick={() => removeKey.mutate()}
            >
              Disconnect
            </Button>
          )}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Labelled label={connected ? 'Replace API key' : 'API key'}>
            <TextInput
              type="password"
              value={key}
              autoComplete="off"
              placeholder="Trading 212 API key"
              onChange={(event) => setKey_(event.target.value)}
            />
          </Labelled>
          <Labelled label="API secret">
            <TextInput
              type="password"
              value={secret}
              autoComplete="off"
              placeholder="Trading 212 API secret"
              onChange={(event) => setSecret(event.target.value)}
            />
          </Labelled>
          <label className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={useDemo}
              onChange={(event) => setUseDemo(event.target.checked)}
            />
            Demo environment (demo.trading212.com)
          </label>
          {setKey.isError && (
            <p className="text-sm text-[var(--negative)]">
              Couldn't save the credentials.
            </p>
          )}
          <div>
            <Button
              type="submit"
              disabled={setKey.isPending || !key.trim() || !secret.trim()}
            >
              Save credentials
            </Button>
          </div>
        </form>

        <p className="text-xs text-[var(--text-muted)]">
          The key is stored encrypted in Supabase Vault. It never lives in the
          browser or as plain text in the database.
        </p>
      </Card>

      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync</CardTitle>
            <p className="text-xs text-[var(--text-muted)]">
              Imports orders, dividends and cash movements.
            </p>
          </div>
          <Button
            disabled={!connected || runSync.isPending}
            onClick={() => runSync.mutate()}
          >
            {runSync.isPending ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>

        {runSync.isError && (
          <Surface elevation="sunken" className="p-4">
            <p className="text-sm text-[var(--negative)]">
              The sync failed. Check the history below.
            </p>
          </Surface>
        )}

        <SyncRunList runs={runs.data ?? []} loading={runs.isLoading} />

        {connected && (
          <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
            <Button
              variant="ghost"
              disabled={clearHistory.isPending}
              onClick={() => clearHistory.mutate()}
            >
              Clear history
            </Button>
            <Button
              variant="ghost"
              disabled={resetSync.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Delete all imported Trading 212 data (transactions, holdings, balances) and start over? Your API key stays connected.',
                  )
                ) {
                  resetSync.mutate();
                }
              }}
            >
              Reset & re-import
            </Button>
          </div>
        )}
      </Card>

      <WidgetCard />
    </div>
  );
};
