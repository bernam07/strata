import { useMemo } from 'react';
import { formatEur, isNegative, zero, type Money } from '@/core/money/money';
import { realizedDisposals, realizedGainsByYear } from '@/core/tax/fifo';
import { disposalsToCsv, foreignIncomeToCsv } from '@/core/tax/exportCsv';
import {
  dividendsByCountry,
  gainsByCountry,
  isForeign,
} from '@/core/tax/anexoJ';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { usePositions } from '@/features/positions/api/usePositions';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { Surface } from '@/ui/Surface';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const countryName: Record<string, string> = {
  US: 'United States',
  IE: 'Ireland',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  GB: 'United Kingdom',
  LU: 'Luxembourg',
  ES: 'Spain',
  CH: 'Switzerland',
  CA: 'Canada',
  JP: 'Japan',
  BE: 'Belgium',
  IT: 'Italy',
  DK: 'Denmark',
  SE: 'Sweden',
  FI: 'Finland',
};

const labelForCountry = (code: string): string => countryName[code] ?? code;

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

  const countryOf = useMemo(() => {
    const instruments = positions.data?.instruments;
    return (instrumentId: string) => {
      const isin = instruments?.get(instrumentId)?.isin;
      return isin && isin.length >= 2 ? isin.slice(0, 2).toUpperCase() : 'Unknown';
    };
  }, [positions.data]);

  const foreign = useMemo(() => {
    const merged = new Map<string, { gain: Money; dividends: Money }>();
    for (const row of gainsByCountry(realizedDisposals(transactions), countryOf)) {
      if (isForeign(row.country)) {
        merged.set(row.country, { gain: row.gain, dividends: zero() });
      }
    }
    for (const row of dividendsByCountry(transactions, countryOf)) {
      if (!isForeign(row.country)) continue;
      const entry = merged.get(row.country) ?? { gain: zero(), dividends: zero() };
      entry.dividends = row.gross;
      merged.set(row.country, entry);
    }
    return [...merged.entries()]
      .map(([country, value]) => ({ country, ...value }))
      .sort((a, b) => b.gain.plus(b.dividends).comparedTo(a.gain.plus(a.dividends)));
  }, [transactions, countryOf]);

  const download = (name: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strata-${name}.csv`;
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

      {foreign.length > 0 && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--text-strong)]">
                Anexo J · foreign income
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Realized gains and dividends by source country (from ISIN). Gains
                settled in EUR — the currency component isn't split.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => download('anexo-j', foreignIncomeToCsv(foreign))}
            >
              Export CSV
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              <span className="flex-1">Country</span>
              <span className="w-24 text-right">Gains</span>
              <span className="w-24 text-right">Dividends</span>
            </div>
            {foreign.map((row) => (
              <div
                key={row.country}
                className="flex items-center gap-3 rounded-[var(--radius-field)] neu-flat px-3 py-2.5"
              >
                <span className="flex-1 text-sm font-semibold text-[var(--text-strong)]">
                  {labelForCountry(row.country)}
                </span>
                <span
                  className="w-24 text-right text-sm tabular-nums"
                  style={{
                    color: isNegative(row.gain)
                      ? 'var(--negative)'
                      : 'var(--text-strong)',
                  }}
                >
                  {formatEur(row.gain)}
                </span>
                <span className="w-24 text-right text-sm tabular-nums text-[var(--positive)]">
                  {formatEur(row.dividends)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <SkeletonRows count={3} />
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
                          `mais-valias-${year.year}`,
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
