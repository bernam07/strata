import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { toast } from '@/ui/toast';
import { BrickEconomyLogo } from '@/features/collectibles/components/BrickEconomyLogo';
import { SecretField } from './SecretField';
import {
  useBrickeconomyConnection,
  useSetBrickeconomyKey,
  useRemoveBrickeconomyKey,
} from './api/useBrickeconomy';

export const BrickEconomyCard = () => {
  const connection = useBrickeconomyConnection();
  const setKey = useSetBrickeconomyKey();
  const removeKey = useRemoveBrickeconomyKey();

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
            ? 'BrickEconomy API key updated'
            : 'BrickEconomy connected successfully',
          'success',
        );
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to save API key', 'error');
      },
    });
  };

  const handleDisconnect = () => {
    removeKey.mutate(undefined, {
      onSuccess: () => {
        setConfirmDisconnect(false);
        setIsEditing(false);
        toast('BrickEconomy disconnected', 'info');
      },
    });
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <BrickEconomyLogo size={44} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[var(--text-strong)]">
                BrickEconomy
              </p>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                Recommended · Sets &amp; Minifigures
              </span>
            </div>
            {connected ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--positive)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                  Connected · Live Valuation Engine Active
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                {connection.isLoading ? 'Checking connection…' : 'Not connected'}
              </p>
            )}
          </div>
        </div>

        {connected && !isEditing && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={startEditing}
            >
              Update API Key
            </Button>
            {confirmDisconnect ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[var(--negative)] hover:text-[var(--negative)]"
                  disabled={removeKey.isPending}
                  onClick={handleDisconnect}
                >
                  {removeKey.isPending ? 'Disconnecting…' : 'Confirm Disconnect'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
              >
                Disconnect
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Connect your BrickEconomy account to automatically fetch real-time secondary market valuations,
        original retail prices, and growth analytics for both LEGO sets and individual minifigures (single API key, no seller account needed).
      </p>

      {isFormUnlocked ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <SecretField
            label="BrickEconomy API Key (x-apikey)"
            hint="Found in your BrickEconomy account profile settings."
            placeholder="Paste your BrickEconomy X-API-Key here"
            value={key}
            visible={showKey}
            disabled={setKey.isPending}
            onChange={setKey_}
            onToggleVisible={() => setShowKey((v) => !v)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="tap inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              {showGuide ? 'Hide instructions' : 'How to find your BrickEconomy API key'}
            </button>

            <div className="flex items-center gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={!trimmedKey || setKey.isPending}
              >
                {setKey.isPending
                  ? 'Saving…'
                  : connected
                    ? 'Save Changes'
                    : 'Connect BrickEconomy'}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="tap inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
          >
            {showGuide ? 'Hide instructions' : 'How to find your BrickEconomy API key'}
          </button>
        </div>
      )}

      {showGuide && (
        <Surface className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 text-xs text-[var(--text-muted)]">
          <p className="font-semibold text-[var(--text-strong)]">
            Step-by-step setup guide:
          </p>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4">
            <li>
              Log in to your account at{' '}
              <a
                href="https://www.brickeconomy.com"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--primary)] underline"
              >
                brickeconomy.com
              </a>.
            </li>
            <li>
              Click on your <strong>Profile</strong> icon at the top right and select <strong>Settings / Profile</strong>.
            </li>
            <li>
              Scroll down to the <strong>API / Developer</strong> section to find your personal <strong>X-API-Key</strong>.
            </li>
            <li>
              Copy the key and paste it into the field above, then click <strong>Connect BrickEconomy</strong>.
            </li>
            <li>
              All LEGO sets and Minifigures will now have instant market valuations and growth tracking in your portfolio.
            </li>
          </ol>
        </Surface>
      )}
    </Card>
  );
};
