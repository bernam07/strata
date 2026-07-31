import { useMemo } from 'react';
import { formatEur, isNegative } from '@/core/money/money';
import { realizedGainsByYear } from '@/core/tax/fifo';
import { disposalsToCsv } from '@/core/tax/exportCsv';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { usePositions } from '@/features/positions/api/usePositions';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const TaxPage = () => {
  const { data: transactions = [], isLoading } = useTransactions();
  const positions = usePositions();

  const nameOf = useMemo(() => {
    const instruments = positions.data?.instruments;
    return (instrumentId: string) =>
      instruments?.get(instrumentId)?.name ??
      instruments?.get(instrumentId)?.ticker ??
      instrumentId;
  }, [positions.data]);

  const years = useMemo(
    () => realizedGainsByYear(transactions),
    [transactions],
  );

  const download = (year: number, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strata-mais-valias-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        Tax
      </h1>
      <p className="text-sm text-[var(--text-muted)]">
        Realized capital gains by FIFO, with fees folded into the acquisition
        cost. Basis for the Portuguese Anexo G.
      </p>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : years.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No realized disposals yet.
        </p>
      ) : (
        years
          .slice()
          .reverse()
          .map((year) => {
            const negative = isNegative(year.gain);
            return (
              <Card key={year.year} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-strong)]">
                      {year.year}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {year.disposals.length} disposals ·{' '}
                      {formatEur(year.proceeds)} proceeds
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="text-lg font-semibold tabular-nums"
                      style={{
                        color: negative
                          ? 'var(--negative)'
                          : 'var(--positive)',
                      }}
                    >
                      {formatEur(year.gain)}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        download(
                          year.year,
                          disposalsToCsv(year.disposals, nameOf),
                        )
                      }
                    >
                      Export CSV
                    </Button>
                  </div>
                </div>

                <ul className="flex flex-col gap-2">
                  {year.disposals.map((disposal, index) => {
                    const loss = isNegative(disposal.gain);
                    return (
                      <Surface
                        key={`${disposal.instrumentId}-${index}`}
                        elevation="flat"
                        className="flex items-center gap-4 p-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[var(--text-strong)]">
                            {nameOf(disposal.instrumentId)}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {dateFormat.format(new Date(disposal.acquiredAt))} →{' '}
                            {dateFormat.format(new Date(disposal.disposedAt))}
                          </p>
                        </div>
                        <span
                          className="font-semibold tabular-nums"
                          style={{
                            color: loss
                              ? 'var(--negative)'
                              : 'var(--positive)',
                          }}
                        >
                          {formatEur(disposal.gain)}
                        </span>
                      </Surface>
                    );
                  })}
                </ul>
              </Card>
            );
          })
      )}
    </div>
  );
};
