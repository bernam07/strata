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
  const [useDemo, setUseDemo] = useState(true);

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
      <h1 className="text-2xl font-bold text-[var(--text-strong)]">
        Integrações
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
                ? `Ligado · ambiente ${connection.data?.useDemo ? 'demo' : 'live'}`
                : 'Não ligado'}
            </p>
          </div>
          {connected && (
            <Button
              variant="ghost"
              disabled={removeKey.isPending}
              onClick={() => removeKey.mutate()}
            >
              Desligar
            </Button>
          )}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Labelled label={connected ? 'Substituir chave da API' : 'Chave da API'}>
            <TextInput
              type="password"
              value={key}
              autoComplete="off"
              placeholder="Cola aqui a chave do Trading 212"
              onChange={(event) => setKey_(event.target.value)}
            />
          </Labelled>
          <label className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={useDemo}
              onChange={(event) => setUseDemo(event.target.checked)}
            />
            Ambiente de demonstração (demo.trading212.com)
          </label>
          {setKey.isError && (
            <p className="text-sm text-[var(--negative)]">
              Não foi possível guardar a chave.
            </p>
          )}
          <div>
            <Button type="submit" disabled={setKey.isPending || !key.trim()}>
              Guardar chave
            </Button>
          </div>
        </form>

        <p className="text-xs text-[var(--text-muted)]">
          A chave é guardada cifrada no Supabase Vault. Nunca fica no browser
          nem em texto simples na base de dados.
        </p>
      </Card>

      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-strong)]">
              Sincronização
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Importa ordens, dividendos e movimentos de caixa.
            </p>
          </div>
          <Button
            disabled={!connected || runSync.isPending}
            onClick={() => runSync.mutate()}
          >
            {runSync.isPending ? 'A sincronizar…' : 'Sincronizar agora'}
          </Button>
        </div>

        {runSync.isError && (
          <Surface elevation="sunken" className="p-4">
            <p className="text-sm text-[var(--negative)]">
              A sincronização falhou. Vê o histórico abaixo.
            </p>
          </Surface>
        )}

        <SyncRunList runs={runs.data ?? []} loading={runs.isLoading} />
      </Card>
    </div>
  );
};
