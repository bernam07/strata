import { useState, type FormEvent } from 'react';
import { icons } from '@/app/icons';
import { Button } from '@/ui/Button';
import { SettingsNav } from '@/ui/HubNav';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { toast } from '@/ui/toast';
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
import type { SyncRun } from './api/useT212';
import { WidgetCard } from './WidgetCard';
import { RebrickableCard } from './RebrickableCard';
import { BricksetCard } from './BricksetCard';
import { TheWatchApiCard } from './TheWatchApiCard';
import { SecretField } from './SecretField';
import { CardTitle } from '@/ui/Heading';

const relativeTime = (date: string): string => {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
};

const latestSuccessful = (runs: SyncRun[] | undefined) =>
  runs?.find((run) => run.status === 'success' && run.finishedAt) ?? null;

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
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connected = connection.data !== null && connection.data !== undefined;
  const isFormUnlocked = !connected || isEditing;
  const trimmedKey = key.trim();
  const trimmedSecret = secret.trim();
  const keysAreIdentical =
    trimmedKey.length > 0 && trimmedKey === trimmedSecret;

  const startEditing = () => {
    setUseDemo(connection.data?.useDemo ?? false);
    setKey_('');
    setSecret('');
    setShowKey(false);
    setShowSecret(false);
    setConfirmDisconnect(false);
    setKey.reset();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setKey_('');
    setSecret('');
    setShowKey(false);
    setShowSecret(false);
    setKey.reset();
    setIsEditing(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedKey || !trimmedSecret || keysAreIdentical) return;
    const wasConnected = connected;
    setKey.mutate(
      { key: trimmedKey, secret: trimmedSecret, useDemo },
      {
        onSuccess: () => {
          setKey_('');
          setSecret('');
          setShowKey(false);
          setShowSecret(false);
          setIsEditing(false);
          toast(
            wasConnected
              ? 'Trading 212 credentials updated'
              : 'Trading 212 connected',
            'success',
          );
        },
      },
    );
  };

  const handleDisconnect = () => {
    removeKey.mutate(undefined, {
      onSuccess: () => {
        setConfirmDisconnect(false);
        setIsEditing(false);
        toast('Trading 212 disconnected', 'info');
      },
    });
  };

  const latest = latestSuccessful(runs.data);
  const running = runs.data?.some((run) => run.status === 'running') ?? false;

  return (
    <div className="flex flex-col gap-6">
      <SettingsNav />

      <PageHeader
        title="Integrations"
        subtitle="Connect Trading 212, Rebrickable & Brickset for automated portfolio sync, and configure mobile widgets and alerts."
      />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            API Integrations
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Direct connections to brokerages, price databases, and collectible catalogs.
          </p>
        </div>

        <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <InstitutionLogo institutionId="trading212" />
            <div>
              <p className="font-semibold text-[var(--text-strong)]">
                Trading 212
              </p>
              {connected ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--positive)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                    Connected · {connection.data?.useDemo ? 'Demo' : 'Live'}
                  </span>
                  {connection.data?.updatedAt && (
                    <span className="text-xs text-[var(--text-muted)]">
                      Updated {relativeTime(connection.data.updatedAt)}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  {connection.isLoading ? 'Checking connection…' : 'Not connected'}
                </p>
              )}
            </div>
          </div>

          {connected && !isEditing && !confirmDisconnect && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={startEditing}>
                Edit credentials
              </Button>
              <Button
                variant="ghost"
                disabled={removeKey.isPending}
                onClick={() => setConfirmDisconnect(true)}
              >
                Disconnect
              </Button>
            </div>
          )}

          {connected && isEditing && (
            <Button variant="ghost" onClick={cancelEditing}>
              Cancel edit
            </Button>
          )}
        </div>

        {connected && confirmDisconnect && (
          <Surface
            elevation="sunken"
            className="flex flex-wrap items-center justify-between gap-3 border border-[color-mix(in_srgb,var(--negative)_35%,transparent)] p-3.5"
          >
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-[var(--text-strong)]">
                Disconnect Trading 212?
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Removes your encrypted API key from Vault. Imported transactions stay intact.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-[var(--negative)] hover:text-[var(--negative)]"
                disabled={removeKey.isPending}
                onClick={handleDisconnect}
              >
                {removeKey.isPending ? 'Disconnecting…' : 'Confirm disconnect'}
              </Button>
              <Button
                variant="ghost"
                disabled={removeKey.isPending}
                onClick={() => setConfirmDisconnect(false)}
              >
                Cancel
              </Button>
            </div>
          </Surface>
        )}

        {connected && !isFormUnlocked ? (
          <Surface elevation="sunken" className="flex flex-col gap-3.5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-[var(--accent)]">
                  <span className="h-4 w-4">{icons.lock}</span>
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-strong)]">
                    API credentials locked
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Stored encrypted in Supabase Vault · Protected from accidental changes
                  </p>
                </div>
              </div>
              <span className="hidden rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] sm:inline-flex">
                {connection.data?.useDemo
                  ? 'demo.trading212.com'
                  : 'trading212.com'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  API Key
                </span>
                <span className="font-mono text-xs tracking-widest text-[var(--text-2)] select-none">
                  •••• •••• •••• ••••
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  API Secret
                </span>
                <span className="font-mono text-xs tracking-widest text-[var(--text-2)] select-none">
                  •••• •••• •••• ••••
                </span>
              </div>
            </div>
          </Surface>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {connected && isEditing && (
              <Surface
                elevation="sunken"
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs text-[var(--text-muted)]"
              >
                <span>
                  Enter a new API Key and Secret below to replace your existing credentials.
                </span>
              </Surface>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-muted)]">
                  Account environment
                </span>
                <button
                  type="button"
                  onClick={() => setShowGuide((prev) => !prev)}
                  className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  {showGuide ? 'Hide setup guide' : 'How to get your API key?'}
                </button>
              </div>

              <Surface
                elevation="sunken"
                className="grid grid-cols-2 gap-1.5 p-1.5"
              >
                <button
                  type="button"
                  onClick={() => setUseDemo(false)}
                  aria-pressed={!useDemo}
                  className={`tap flex flex-col items-start rounded-lg px-3 py-2 text-left transition-all ${
                    !useDemo
                      ? 'neu-raised text-[var(--text-strong)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'
                  }`}
                >
                  <span className="text-xs font-semibold">Live Account</span>
                  <span className="text-[11px] text-[var(--text-subtle)]">
                    Real money · trading212.com
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setUseDemo(true)}
                  aria-pressed={useDemo}
                  className={`tap flex flex-col items-start rounded-lg px-3 py-2 text-left transition-all ${
                    useDemo
                      ? 'neu-raised text-[var(--text-strong)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'
                  }`}
                >
                  <span className="text-xs font-semibold">Practice / Demo</span>
                  <span className="text-[11px] text-[var(--text-subtle)]">
                    Paper trading · demo.trading212.com
                  </span>
                </button>
              </Surface>
            </div>

            {(!connected || showGuide) && (
              <Surface
                elevation="sunken"
                className="flex flex-col gap-2 p-3.5 text-xs text-[var(--text-muted)]"
              >
                <p className="font-semibold text-[var(--text-2)]">
                  Where to find your Trading 212 API credentials:
                </p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    In the Trading 212 app, open{' '}
                    <strong className="text-[var(--text-2)]">
                      Settings → API (Beta)
                    </strong>
                    .
                  </li>
                  <li>
                    Tap{' '}
                    <strong className="text-[var(--text-2)]">
                      Generate API key
                    </strong>{' '}
                    and enable read permissions for{' '}
                    <span className="text-[var(--text-2)]">
                      Account data, Metadata, Orders, Dividends &amp; Transactions
                    </span>
                    .
                  </li>
                  <li>
                    Copy both the{' '}
                    <strong className="text-[var(--text-2)]">API Key</strong> and{' '}
                    <strong className="text-[var(--text-2)]">Secret Key</strong>{' '}
                    (shown only once) and paste them below.
                  </li>
                </ol>
              </Surface>
            )}

            <SecretField
              label={connected ? 'New API key' : 'API key'}
              hint="Public key ID"
              placeholder="Paste your Trading 212 API key"
              value={key}
              visible={showKey}
              disabled={setKey.isPending}
              onChange={setKey_}
              onToggleVisible={() => setShowKey((prev) => !prev)}
            />

            <SecretField
              label={connected ? 'New API secret' : 'API secret'}
              hint="Shown once on creation"
              placeholder="Paste your Trading 212 API secret"
              value={secret}
              visible={showSecret}
              disabled={setKey.isPending}
              onChange={setSecret}
              onToggleVisible={() => setShowSecret((prev) => !prev)}
            />

            {keysAreIdentical && (
              <p role="alert" className="text-xs text-[var(--negative)]">
                API key and API secret appear to be identical. Make sure you copied both distinct values from Trading 212.
              </p>
            )}

            {setKey.isError && (
              <p role="alert" className="text-sm text-[var(--negative)]">
                Couldn't save the credentials. Please verify your connection and try again.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="submit"
                disabled={
                  setKey.isPending ||
                  !trimmedKey ||
                  !trimmedSecret ||
                  keysAreIdentical
                }
              >
                {setKey.isPending
                  ? 'Saving…'
                  : connected
                    ? 'Update credentials'
                    : 'Connect Trading 212'}
              </Button>
              {connected && isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={setKey.isPending}
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
              )}
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Your credentials are encrypted in Supabase Vault and never stored in the browser or as plain text in the database.
            </p>
          </form>
        )}
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

        <Surface elevation="sunken" className="flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-sm font-semibold text-[var(--text-2)]">
            {running
              ? 'Sync in progress'
              : latest
                ? `Last synced ${relativeTime(latest.finishedAt!)}`
                : 'No successful sync yet'}
          </span>
          {latest && (
            <span className="text-xs text-[var(--text-muted)]">
              {latest.insertedRows} new {latest.insertedRows === 1 ? 'row' : 'rows'}
            </span>
          )}
        </Surface>

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

        <RebrickableCard />
        <BricksetCard />
        <TheWatchApiCard />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-strong)]">
            Tools &amp; Extensions
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Home screen widgets, Apple Shortcuts, and system notification delivery channels.
          </p>
        </div>

        <WidgetCard />
        <NotificationsCard />
      </section>
    </div>
  );
};
