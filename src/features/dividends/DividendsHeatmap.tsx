import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  DividendCadence,
  ExpectedDividend,
  ReceivedDividend,
} from '@/core/dividends/projectDividends';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import { AmountInline } from '@/ui/Amount';
import { Card } from '@/ui/Card';

interface HeatmapPayout {
  id: string;
  instrumentId: string;
  amount: number;
  date: string;
  cadence?: DividendCadence;
  estimated: boolean;
  exDividendAt?: string;
  confirmedDate?: boolean;
}

interface HeatmapCell {
  monthKey: string;
  shortLabel: string;
  yearLabel: string;
  fullLabel: string;
  total: number;
  payouts: HeatmapPayout[];
  isCurrentMonth: boolean;
}

const shortDayFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

const exDateEstimate = (isoDate: string): string => {
  const paidMs = Date.parse(isoDate);
  if (Number.isNaN(paidMs)) return '';
  const exDate = new Date(paidMs - 14 * 86_400_000);
  return shortDayFormat.format(exDate);
};

export const DividendsHeatmap = ({
  mode,
  received,
  expected,
  instruments,
}: {
  mode: 'received' | 'expected';
  received: readonly (ReceivedDividend & { id?: string })[];
  expected: readonly ExpectedDividend[];
  instruments: Map<string, InstrumentMeta>;
}) => {
  const cells = useMemo<HeatmapCell[]>(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}`;

    const list: HeatmapCell[] = [];
    const byKey = new Map<string, HeatmapCell>();

    for (let i = 0; i < 12; i += 1) {
      const offset = mode === 'received' ? i - 11 : i;
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      const cell: HeatmapCell = {
        monthKey: key,
        shortLabel: d.toLocaleDateString('en-GB', { month: 'short' }),
        yearLabel: `'${String(d.getFullYear()).slice(-2)}`,
        fullLabel: d.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        }),
        total: 0,
        payouts: [],
        isCurrentMonth: key === currentKey,
      };
      list.push(cell);
      byKey.set(key, cell);
    }

    if (mode === 'received') {
      for (let idx = 0; idx < received.length; idx += 1) {
        const item = received[idx]!;
        const cell = byKey.get(item.paidAt.slice(0, 7));
        if (!cell) continue;
        const amt = Number(item.amount);
        cell.total += amt;
        cell.payouts.push({
          id: item.id ?? `${item.instrumentId}-${item.paidAt}-${idx}`,
          instrumentId: item.instrumentId,
          amount: amt,
          date: item.paidAt,
          estimated: false,
        });
      }
    } else {
      for (let idx = 0; idx < expected.length; idx += 1) {
        const item = expected[idx]!;
        const cell = byKey.get(item.expectedAt.slice(0, 7));
        if (!cell) continue;
        const amt = Number(item.estimatedAmount);
        cell.total += amt;
        cell.payouts.push({
          id: `${item.instrumentId}-${item.expectedAt}-${idx}`,
          instrumentId: item.instrumentId,
          amount: amt,
          date: item.expectedAt,
          cadence: item.cadence,
          estimated: true,
          exDividendAt: item.exDividendAt,
          confirmedDate: item.confirmedDate,
        });
      }
    }

    for (const cell of list) {
      cell.payouts.sort((a, b) => (a.date < b.date ? -1 : 1));
    }

    return list;
  }, [mode, received, expected]);

  const defaultSelected = useMemo(() => {
    const nowKey = `${new Date().getFullYear()}-${String(
      new Date().getMonth() + 1,
    ).padStart(2, '0')}`;
    const currentWithPayouts = cells.find(
      (c) => c.monthKey === nowKey && c.total > 0,
    );
    if (currentWithPayouts) return currentWithPayouts.monthKey;
    if (mode === 'received') {
      const latestWithPayouts = [...cells].reverse().find((c) => c.total > 0);
      return latestWithPayouts?.monthKey ?? nowKey;
    }
    const nextWithPayouts = cells.find((c) => c.total > 0);
    return nextWithPayouts?.monthKey ?? nowKey;
  }, [cells, mode]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey =
    selectedKey && cells.some((c) => c.monthKey === selectedKey)
      ? selectedKey
      : defaultSelected;

  const maxMonthTotal = useMemo(
    () => Math.max(0, ...cells.map((c) => c.total)),
    [cells],
  );
  const activeMonthsCount = useMemo(
    () => cells.filter((c) => c.total > 0).length,
    [cells],
  );
  const annualTotal = useMemo(
    () => cells.reduce((acc, c) => acc + c.total, 0),
    [cells],
  );
  const peakCell = useMemo(() => {
    let best: HeatmapCell | null = null;
    for (const c of cells) {
      if (c.total > (best?.total ?? 0)) best = c;
    }
    return best;
  }, [cells]);

  const activeCell =
    cells.find((c) => c.monthKey === activeKey) ?? cells[cells.length - 1]!;

  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {mode === 'received'
              ? '12-Month Dividend Heatmap'
              : 'Projected Payout Heatmap'}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Tap any month to inspect paying positions
            {mode === 'expected' ? ' & estimated ex-div dates' : ''}.
          </p>
        </div>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--positive)_15%,transparent)] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[var(--positive)]">
          {activeMonthsCount}/12 active mos
        </span>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Monthly avg
          </span>
          <span className="truncate text-sm font-bold text-[var(--text-strong)]">
            {mode === 'expected' && '~'}
            <AmountInline value={annualTotal / 12} />
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Peak month
          </span>
          <span className="truncate text-sm font-bold text-[var(--positive)]">
            {peakCell ? (
              <>
                {peakCell.shortLabel} · <AmountInline value={peakCell.total} />
              </>
            ) : (
              '—'
            )}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            12M total
          </span>
          <span className="truncate text-sm font-bold text-[var(--positive)]">
            {mode === 'expected' && '~'}
            <AmountInline value={annualTotal} />
          </span>
        </div>
      </div>

      {/* 12-Month Heatmap Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cells.map((cell) => {
          const intensity =
            maxMonthTotal > 0 && cell.total > 0
              ? Math.max(0.18, Math.min(1, cell.total / maxMonthTotal))
              : 0;
          const isSelected = cell.monthKey === activeCell.monthKey;
          const uniqueInstruments = [
            ...new Set(cell.payouts.map((p) => p.instrumentId)),
          ].slice(0, 3);

          const bgMix =
            intensity > 0
              ? `color-mix(in srgb, var(--positive) ${Math.round(
                  10 + intensity * 28,
                )}%, var(--surface-raised))`
              : 'var(--surface-sunken)';

          const borderMix = isSelected
            ? 'var(--positive)'
            : intensity > 0
              ? `color-mix(in srgb, var(--positive) ${Math.round(
                  20 + intensity * 40,
                )}%, var(--line))`
              : 'var(--line)';

          return (
            <button
              key={cell.monthKey}
              type="button"
              onClick={() => setSelectedKey(cell.monthKey)}
              className="tap relative flex min-w-0 flex-col justify-between gap-2 rounded-[var(--radius-field)] p-2.5 text-left transition-all"
              style={{
                background: bgMix,
                border: `1px solid ${borderMix}`,
                boxShadow: isSelected
                  ? '0 0 0 1px var(--positive), 0 8px 20px -10px color-mix(in srgb, var(--positive) 45%, transparent)'
                  : undefined,
              }}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)]">
                  {cell.shortLabel}{' '}
                  <span className="font-normal text-[var(--text-muted)]">
                    {cell.yearLabel}
                  </span>
                </span>
                {cell.isCurrentMonth && (
                  <span
                    title="Current month"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <span
                  className={`truncate text-xs font-extrabold tabular-nums ${
                    cell.total > 0
                      ? 'text-[var(--text-strong)]'
                      : 'text-[var(--text-muted)] opacity-50'
                  }`}
                >
                  {cell.total > 0 ? (
                    <>
                      {mode === 'expected' && '~'}
                      <AmountInline value={cell.total} />
                    </>
                  ) : (
                    '€0'
                  )}
                </span>

                <div className="flex min-h-[18px] items-center justify-between gap-1">
                  {uniqueInstruments.length > 0 ? (
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {uniqueInstruments.map((instId) => {
                        const meta = instruments.get(instId);
                        return (
                          <div
                            key={instId}
                            className="rounded-full ring-1 ring-[var(--surface-raised)]"
                          >
                            <StockAvatar
                              ticker={meta?.ticker ?? instId}
                              isin={meta?.isin}
                              size={16}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] opacity-40">
                      No payouts
                    </span>
                  )}

                  {cell.payouts.length > 0 && (
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[var(--positive)]">
                      {cell.payouts.length}×
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Month Breakdown */}
      <div className="flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-strong)]">
              {activeCell.fullLabel}
            </span>
            <span className="shrink-0 rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
              {activeCell.payouts.length}{' '}
              {activeCell.payouts.length === 1 ? 'payout' : 'payouts'}
            </span>
          </div>
          <span className="shrink-0 text-sm font-extrabold tabular-nums text-[var(--positive)]">
            {mode === 'expected' && activeCell.total > 0 && '~'}
            <AmountInline value={activeCell.total} />
          </span>
        </div>

        {activeCell.payouts.length === 0 ? (
          <p className="py-2 text-xs text-[var(--text-muted)]">
            No {mode === 'received' ? 'received' : 'projected'} dividends in{' '}
            {activeCell.fullLabel}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeCell.payouts.map((payout) => {
              const meta = instruments.get(payout.instrumentId);
              const name = meta?.name ?? meta?.ticker ?? 'Instrument';
              const exDivDateText = payout.exDividendAt
                ? shortDayFormat.format(new Date(payout.exDividendAt))
                : exDateEstimate(payout.date);

              return (
                <li key={payout.id}>
                  <Link
                    to={`/positions/${payout.instrumentId}`}
                    className="tap flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-field)] bg-[var(--surface-raised)] px-3 py-2.5 transition hover:bg-[var(--surface-flat)]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StockAvatar
                        ticker={meta?.ticker ?? payout.instrumentId}
                        isin={meta?.isin}
                        size={28}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-[var(--text-strong)]">
                            {name}
                          </p>
                          {payout.confirmedDate && (
                            <span className="shrink-0 rounded bg-[color-mix(in_srgb,var(--positive)_18%,transparent)] px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-[var(--positive)]">
                              Confirmed
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          <span>{shortDayFormat.format(new Date(payout.date))}</span>
                          {exDivDateText && (
                            <>
                              {' · '}
                              <span className="text-[var(--accent)]">
                                Ex-div {payout.exDividendAt ? exDivDateText : `~${exDivDateText}`}
                              </span>
                            </>
                          )}
                          {payout.cadence && ` · ${payout.cadence}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--positive)]">
                        {payout.estimated && '~'}
                        <AmountInline value={payout.amount} />
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">→</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};
