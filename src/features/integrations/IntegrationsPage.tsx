import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { Surface } from '@/ui/Surface';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import {
  useRemoveT212Key,
  useRunSync,
  useSetT212Key,
  useSyncRuns,
  useT212Connection,
} from './api/useT212';
import { SyncRunList } from './SyncRunList';

export const IntegrationsPage = () => {
  const connection = useT212Connection();
  const setKey = useSetT212Key();
  const removeKey = useRemoveT212Key();
  const runSync = useRunSync();
  const runs = useSyncRuns();

  const [key, setKey_] = useState('');
  const [useDemo, setUseDemo] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    setKey.mutate(
      { key: key.trim(), useDemo },
      { onSuccess: () => setKey_('') },
    );
  };

  const connected = connection.data !== null && connection.data !== undefined;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        Integrations
      </h1>

      <Card className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <InstitutionLogo institutionId="trading212" />
          <div className="flex-1">
            <p className="font-semibold text-[var(--text-strong)]">
              Trading 212
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {connected
                ? `Connected · ${connection.data?.useDemo ? 'demo' : 'live'} environment`
                : 'Not connected'}
            </p>
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
              placeholder="Paste your Trading 212 API key"
              onChange={(event) => setKey_(event.target.value)}
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
              Couldn't save the key.
            </p>
          )}
          <div>
            <Button type="submit" disabled={setKey.isPending || !key.trim()}>
              Save key
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
            <h2 className="font-semibold text-[var(--text-strong)]">Sync</h2>
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
      </Card>
    </div>
  );
};
