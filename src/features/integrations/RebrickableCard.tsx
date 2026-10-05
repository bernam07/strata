import { useState, type FormEvent } from 'react';
import { icons } from '@/app/icons';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { toast } from '@/ui/toast';
import { RebrickableLogo } from '@/features/collectibles/components/RebrickableLogo';
import { SecretField } from './SecretField';
import {
  useRebrickableConnection,
  useSetRebrickableKey,
  useRemoveRebrickableKey,
} from './api/useRebrickable';

export const RebrickableCard = () => {
  const connection = useRebrickableConnection();
  const setKey = useSetRebrickableKey();
  const removeKey = useRemoveRebrickableKey();

  const [key, setKey_] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connected = connection.data !== null && connection.data !== undefined;
  const isFormUnlocked = !connected || isEditing;
  const trimmedKey = key.trim();

  const startEditing = () => {
    setKey_('');
    setShowKey(false);
    setConfirmDisconnect(false);
    setKey.reset();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setKey_('');
    setShowKey(false);
    setKey.reset();
    setIsEditing(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedKey) return;
    const wasConnected = connected;
    setKey.mutate(trimmedKey, {
      onSuccess: () => {
        setKey_('');
        setShowKey(false);
        setIsEditing(false);
        toast(
          wasConnected
            ? 'Rebrickable credentials updated'
            : 'Rebrickable connected',
          'success',
        );
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to save key', 'error');
      },
    });
  };

  const handleDisconnect = () => {
    removeKey.mutate(undefined, {
      onSuccess: () => {
        setConfirmDisconnect(false);
        setIsEditing(false);
        toast('Rebrickable disconnected', 'info');
      },
    });
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <RebrickableLogo size={44} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[var(--text-strong)]">
                Rebrickable
              </p>
              <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                LEGO &amp; Minifigures
              </span>
            </div>
            {connected ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--positive)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                  Connected · Live Catalog &amp; Minifigures Active
                </span>
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
              Disconnect Rebrickable?
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Removes your API key from Vault. Saved LEGO sets and minifigures remain in your portfolio.
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
                  API Key locked &amp; active
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Stored encrypted in Supabase Vault · Powers live search across 20,000+ LEGO sets &amp; minifigures
                </p>
              </div>
            </div>
            <span className="hidden rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] sm:inline-flex">
              rebrickable.com
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Rebrickable v3 Key
            </span>
            <span className="font-mono text-xs tracking-widest text-[var(--text-2)] select-none">
              •••• •••• •••• ••••
            </span>
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
                Enter a new Rebrickable API key below to replace your existing credentials.
              </span>
            </Surface>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-muted)]">
                Catalog Integration
              </span>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                {showGuide ? 'Hide setup guide' : 'How to get your API key?'}
              </button>
            </div>

            {(!connected || showGuide) && (
              <Surface
                elevation="sunken"
                className="flex flex-col gap-2 p-3.5 text-xs text-[var(--text-muted)]"
              >
                <p className="font-semibold text-[var(--text-2)]">
                  Where to get your free Rebrickable API key:
                </p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    Log in or create a free account at{' '}
                    <a
                      href="https://rebrickable.com/register/"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] underline"
                    >
                      rebrickable.com
                    </a>
                    .
                  </li>
                  <li>
                    Open{' '}
                    <a
                      href="https://rebrickable.com/api/"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] underline"
                    >
                      rebrickable.com/api
                    </a>{' '}
                    or go to your profile Settings → API.
                  </li>
                  <li>
                    Copy your <strong className="text-[var(--text-2)]">API Key (v3)</strong> and paste it below.
                  </li>
                </ol>
              </Surface>
            )}
          </div>

          <SecretField
            label={connected ? 'New API key' : 'API key'}
            hint="Rebrickable v3 API Key"
            placeholder="Paste your Rebrickable API key"
            value={key}
            visible={showKey}
            disabled={setKey.isPending}
            onChange={setKey_}
            onToggleVisible={() => setShowKey((prev) => !prev)}
          />

          {setKey.isError && (
            <p role="alert" className="text-sm text-[var(--negative)]">
              Couldn&apos;t save the credentials. Please verify your connection and try again.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              disabled={setKey.isPending || !trimmedKey}
            >
              {setKey.isPending
                ? 'Saving…'
                : connected
                  ? 'Update credentials'
                  : 'Connect Rebrickable'}
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
            Your key is encrypted in Supabase Vault and used to query official sets and rare minifigures in real-time.
          </p>
        </form>
      )}
    </Card>
  );
};
