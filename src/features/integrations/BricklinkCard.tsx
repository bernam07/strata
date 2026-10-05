import { useState, type FormEvent } from 'react';
import { icons } from '@/app/icons';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { toast } from '@/ui/toast';
import { BricklinkLogo } from '@/features/collectibles/components/BricklinkLogo';
import { SecretField } from './SecretField';
import {
  useBricklinkConnection,
  useSetBricklinkCredentials,
  useRemoveBricklinkCredentials,
} from './api/useBricklink';

export const BricklinkCard = () => {
  const connection = useBricklinkConnection();
  const setCredentials = useSetBricklinkCredentials();
  const removeCredentials = useRemoveBricklinkCredentials();

  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [tokenSecret, setTokenSecret] = useState('');

  const [showConsumerKey, setShowConsumerKey] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [showTokenValue, setShowTokenValue] = useState(false);
  const [showTokenSecret, setShowTokenSecret] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connected = connection.data !== null && connection.data !== undefined;
  const isFormUnlocked = !connected || isEditing;

  const trimmedConsumerKey = consumerKey.trim();
  const trimmedConsumerSecret = consumerSecret.trim();
  const trimmedTokenValue = tokenValue.trim();
  const trimmedTokenSecret = tokenSecret.trim();

  const isFormValid =
    Boolean(trimmedConsumerKey) &&
    Boolean(trimmedConsumerSecret) &&
    Boolean(trimmedTokenValue) &&
    Boolean(trimmedTokenSecret);

  const startEditing = () => {
    setConsumerKey('');
    setConsumerSecret('');
    setTokenValue('');
    setTokenSecret('');
    setShowConsumerKey(false);
    setShowConsumerSecret(false);
    setShowTokenValue(false);
    setShowTokenSecret(false);
    setConfirmDisconnect(false);
    setCredentials.reset();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setConsumerKey('');
    setConsumerSecret('');
    setTokenValue('');
    setTokenSecret('');
    setShowConsumerKey(false);
    setShowConsumerSecret(false);
    setShowTokenValue(false);
    setShowTokenSecret(false);
    setCredentials.reset();
    setIsEditing(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isFormValid) return;
    const wasConnected = connected;
    setCredentials.mutate(
      {
        consumerKey: trimmedConsumerKey,
        consumerSecret: trimmedConsumerSecret,
        tokenValue: trimmedTokenValue,
        tokenSecret: trimmedTokenSecret,
      },
      {
        onSuccess: () => {
          setConsumerKey('');
          setConsumerSecret('');
          setTokenValue('');
          setTokenSecret('');
          setIsEditing(false);
          toast(
            wasConnected
              ? 'BrickLink credentials updated'
              : 'BrickLink connected',
            'success',
          );
        },
        onError: (err) => {
          toast(
            err instanceof Error ? err.message : 'Failed to save BrickLink keys',
            'error',
          );
        },
      },
    );
  };

  const handleDisconnect = () => {
    removeCredentials.mutate(undefined, {
      onSuccess: () => {
        setConfirmDisconnect(false);
        setIsEditing(false);
        toast('BrickLink disconnected', 'info');
      },
    });
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <BricklinkLogo size={44} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[var(--text-strong)]">
                BrickLink
              </p>
              <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                Optional · Store Sellers
              </span>
            </div>
            {connected ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--positive)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                  Connected · Live Price Guide Active (EUR)
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
              disabled={removeCredentials.isPending}
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

      <p className="text-sm text-[var(--text-muted)]">
        Connect your BrickLink Store API keys (OAuth 1.0) to query 6-month historical sales and current stock price guides.
        Note: The official BrickLink API is restricted by BrickLink to verified store sellers. For personal collections, use the single-key BrickEconomy integration above.
      </p>

      {connected && confirmDisconnect && (
        <Surface
          elevation="sunken"
          className="flex flex-wrap items-center justify-between gap-3 border border-[color-mix(in_srgb,var(--negative)_35%,transparent)] p-3.5"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              Disconnect BrickLink?
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Removes your OAuth credentials from Vault. Saved LEGO sets and minifigures remain in your portfolio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="text-[var(--negative)] hover:text-[var(--negative)]"
              disabled={removeCredentials.isPending}
              onClick={handleDisconnect}
            >
              {removeCredentials.isPending ? 'Disconnecting…' : 'Confirm disconnect'}
            </Button>
            <Button
              variant="ghost"
              disabled={removeCredentials.isPending}
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
                  API Credentials locked &amp; active
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Stored encrypted in Supabase Vault · Queries real-time 6-month sales and stock prices
                </p>
              </div>
            </div>
            <span className="hidden rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)] sm:inline-flex">
              api.bricklink.com
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Consumer Key
              </span>
              <span className="font-mono text-xs tracking-widest text-[var(--text-2)] select-none">
                •••• •••• •••• ••••
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Consumer Secret
              </span>
              <span className="font-mono text-xs tracking-widest text-[var(--text-2)] select-none">
                •••• •••• •••• ••••
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Token Value
              </span>
              <span className="font-mono text-xs tracking-widest text-[var(--text-2)] select-none">
                •••• •••• •••• ••••
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--surface-raised)] px-3 py-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Token Secret
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
                Enter your new BrickLink credentials below to replace existing tokens.
              </span>
            </Surface>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-muted)]">
                Price Guide Integration
              </span>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                {showGuide ? 'Hide setup guide' : 'How to get your API keys?'}
              </button>
            </div>

            {(!connected || showGuide) && (
              <Surface
                elevation="sunken"
                className="flex flex-col gap-2.5 p-3.5 text-xs text-[var(--text-muted)]"
              >
                <div className="rounded border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-2.5 text-xs text-[var(--text-strong)]">
                  <p className="font-semibold text-[var(--accent)]">
                    Important: BrickLink Seller Requirement
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
                    BrickLink strictly restricts OAuth API key generation to registered <strong>Seller Accounts</strong> with an active store (which requires past buyer feedback).
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
                    If you do not sell on BrickLink, <strong>this integration is optional</strong>. You can use <strong>Rebrickable</strong> (100% free and open for everyone) to search the LEGO catalog and minifigures, and use Strata&apos;s 1-click price guide links to check current market values.
                  </p>
                </div>

                <p className="font-semibold text-[var(--text-2)] pt-1">
                  If you have a BrickLink Seller account:
                </p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    Log in to your account at{' '}
                    <a
                      href="https://www.bricklink.com"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] underline"
                    >
                      bricklink.com
                    </a>
                    .
                  </li>
                  <li>
                    Go to{' '}
                    <a
                      href="https://www.bricklink.com/v2/api/register_consumer.page"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] underline"
                    >
                      API Settings / Register Consumer
                    </a>
                    .
                  </li>
                  <li>
                    Click <strong className="text-[var(--text-2)]">Generate New Tokens</strong> (IP Mask can be left empty).
                  </li>
                  <li>
                    Copy the 4 generated keys and paste them into the fields below.
                  </li>
                </ol>
              </Surface>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SecretField
              label={connected ? 'New Consumer Key' : 'Consumer Key'}
              hint="IP Consumer Key"
              placeholder="Paste your Consumer Key"
              value={consumerKey}
              visible={showConsumerKey}
              disabled={setCredentials.isPending}
              onChange={setConsumerKey}
              onToggleVisible={() => setShowConsumerKey((prev) => !prev)}
            />

            <SecretField
              label={connected ? 'New Consumer Secret' : 'Consumer Secret'}
              hint="IP Consumer Secret"
              placeholder="Paste your Consumer Secret"
              value={consumerSecret}
              visible={showConsumerSecret}
              disabled={setCredentials.isPending}
              onChange={setConsumerSecret}
              onToggleVisible={() => setShowConsumerSecret((prev) => !prev)}
            />

            <SecretField
              label={connected ? 'New Token Value' : 'Token Value'}
              hint="Token Value"
              placeholder="Paste your Token Value"
              value={tokenValue}
              visible={showTokenValue}
              disabled={setCredentials.isPending}
              onChange={setTokenValue}
              onToggleVisible={() => setShowTokenValue((prev) => !prev)}
            />

            <SecretField
              label={connected ? 'New Token Secret' : 'Token Secret'}
              hint="Token Secret"
              placeholder="Paste your Token Secret"
              value={tokenSecret}
              visible={showTokenSecret}
              disabled={setCredentials.isPending}
              onChange={setTokenSecret}
              onToggleVisible={() => setShowTokenSecret((prev) => !prev)}
            />
          </div>

          {setCredentials.isError && (
            <p role="alert" className="text-sm text-[var(--negative)]">
              Couldn&apos;t save the credentials. Please verify your connection and try again.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              disabled={setCredentials.isPending || !isFormValid}
            >
              {setCredentials.isPending
                ? 'Saving…'
                : connected
                  ? 'Update credentials'
                  : 'Connect BrickLink'}
            </Button>
            {connected && isEditing && (
              <Button
                type="button"
                variant="ghost"
                disabled={setCredentials.isPending}
                onClick={cancelEditing}
              >
                Cancel
              </Button>
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Your keys are encrypted in Supabase Vault and used to query real-time market value for LEGO sets and minifigures.
          </p>
        </form>
      )}
    </Card>
  );
};
