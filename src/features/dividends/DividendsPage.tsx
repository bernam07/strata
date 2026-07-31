import { useState } from 'react';
import { formatEur, money, sum } from '@/core/money/money';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { useDividends } from './api/useDividends';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';

type Tab = 'received' | 'expected';

const dateFormat = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const cadenceLabel: Record<string, string> = {
  monthly: 'mensal',
  quarterly: 'trimestral',
  semiannual: 'semestral',
  annual: 'anual',
};

const nameOf = (
  instruments: Map<string, InstrumentMeta>,
  instrumentId: string,
): string =>
  instruments.get(instrumentId)?.name ??
  instruments.get(instrumentId)?.ticker ??
  'Instrumento';

export const DividendsPage = () => {
  const { data, isLoading } = useDividends();
  const [tab, setTab] = useState<Tab>('received');

  const received = data?.received ?? [];
  const expected = data?.expected ?? [];
  const instruments = data?.instruments ?? new Map<string, InstrumentMeta>();

  const receivedTotal = sum(received.map((item) => money(item.amount)));
  const expectedTotal = sum(expected.map((item) => money(item.estimatedAmount)));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-[var(--text-strong)]">Dividendos</h1>

      <div className="flex gap-2 rounded-[var(--radius-neu-sm)] neu-sunken p-1.5 self-start">
        <button
          type="button"
          onClick={() => setTab('received')}
          className={`rounded-[var(--radius-neu-sm)] px-4 py-1.5 text-sm font-semibold ${
            tab === 'received'
              ? 'neu-flat text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Recebidos
        </button>
        <button
          type="button"
          onClick={() => setTab('expected')}
          className={`rounded-[var(--radius-neu-sm)] px-4 py-1.5 text-sm font-semibold ${
            tab === 'expected'
              ? 'neu-flat text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Calendário
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">A carregar…</p>
      ) : tab === 'received' ? (
        <>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Total recebido
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--positive)]">
              {formatEur(receivedTotal)}
            </p>
          </Card>
          {received.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Ainda não há dividendos recebidos.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {received.map((item) => (
                <Surface
                  key={item.id}
                  elevation="flat"
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-strong)]">
                      {nameOf(instruments, item.instrumentId)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {dateFormat.format(new Date(item.paidAt))}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--positive)]">
                    {formatEur(money(item.amount))}
                  </span>
                </Surface>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Estimativa próximos 12 meses
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-muted)]">
              {formatEur(expectedTotal)}
            </p>
          </Card>
          {expected.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Sem histórico suficiente para projetar um calendário.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {expected
                .slice()
                .sort((a, b) =>
                  a.expectedAt < b.expectedAt ? -1 : 1,
                )
                .map((item, index) => (
                  <Surface
                    key={`${item.instrumentId}-${index}`}
                    elevation="flat"
                    className="flex items-center justify-between border border-dashed border-[var(--text-muted)]/30 p-4 opacity-60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-strong)]">
                        {nameOf(instruments, item.instrumentId)}
                        <span className="ml-2 rounded-full neu-sunken px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                          estimado · {cadenceLabel[item.cadence]}
                        </span>
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {dateFormat.format(new Date(item.expectedAt))}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[var(--text-muted)]">
                      ~{formatEur(money(item.estimatedAmount))}
                    </span>
                  </Surface>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
