import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { toast } from '@/ui/toast';
import { SecretField } from './SecretField';
import {
  useBricksetConnection,
  useSetBricksetKey,
  useRemoveBricksetKey,
} from './api/useBrickset';

export const BricksetCard = () => {
  const connection = useBricksetConnection();
  const setKey = useSetBricksetKey();
  const removeKey = useRemoveBricksetKey();
  const [key, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const connected = connection.data !== null && connection.data !== undefined;
  const trimmedKey = key.trim();

  const reset = () => {
    setKeyValue('');
    setShowKey(false);
    setIsEditing(false);
    setConfirmDisconnect(false);
    setKey.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedKey) return;
    setKey.mutate(trimmedKey, {
      onSuccess: () => {
        reset();
        toast(connected ? 'Brickset API key updated' : 'Brickset connected', 'success');
      },
      onError: (error) => toast(error.message, 'error'),
    });
  };

  const disconnect = () => {
    removeKey.mutate(undefined, {
      onSuccess: () => {
        reset();
        toast('Brickset disconnected', 'info');
      },
      onError: (error) => toast(error.message, 'error'),
    });
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[var(--text-strong)]">Brickset</p>
            <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
              Free · Official RRP
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {connected ? 'Connected · LEGO retail prices available' : 'Not connected'}
          </p>
        </div>
        {connected && !isEditing && !confirmDisconnect && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Update API key
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)]">
        Brickset is free for personal use and supplies official LEGO retail prices for sets. It does not estimate used-market prices or minifigure resale values.
      </p>

      {confirmDisconnect ? (
        <Surface elevation="sunken" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm text-[var(--text-muted)]">Remove the saved Brickset API key?</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
            <Button variant="ghost" className="text-[var(--negative)]" onClick={disconnect} disabled={removeKey.isPending}>
              {removeKey.isPending ? 'Removing…' : 'Confirm disconnect'}
            </Button>
          </div>
        </Surface>
      ) : (!connected || isEditing) ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <SecretField
            label="Brickset API key"
            hint="Create a free key at brickset.com/tools/webservices/requestkey"
            placeholder="Paste your Brickset API key"
            value={key}
            visible={showKey}
            disabled={setKey.isPending}
            onChange={setKeyValue}
            onToggleVisible={() => setShowKey((value) => !value)}
          />
          <div className="flex justify-end gap-2">
            {isEditing && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
            <Button type="submit" size="sm" disabled={!trimmedKey || setKey.isPending}>
              {setKey.isPending ? 'Saving…' : connected ? 'Save changes' : 'Connect Brickset'}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
};
