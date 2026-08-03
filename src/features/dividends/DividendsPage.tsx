import { useMemo, useState } from 'react';
import { formatEur, money, sum } from '@/core/money/money';
import {
  annualIncomeByInstrument,
  expectedByMonth,
} from '@/core/dividends/forecast';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { Surface } from '@/ui/Surface';
import { useDividends } from './api/useDividends';
import { DividendsBarChart } from './DividendsBarChart';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import {
  usePositions,
  type InstrumentMeta,
} from '@/features/positions/api/usePositions';

type Tab = 'received' | 'expected';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const cadenceLabel: Record<string, string> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  semiannual: 'semiannual',
  annual: 'annual',
};

const nameOf = (
  instruments: Map<string, InstrumentMeta>,
  instrumentId: string,
): string =>
  instruments.get(instrumentId)?.name ??
  instruments.get(instrumentId)?.ticker ??
  'Instrument';

export const DividendsPage = () => {
  const { data, isLoading } = useDividends();
  const positionsQuery = usePositions();
  const [tab, setTab] = useState<Tab>('received');

  const received = data?.received ?? [];
  const expected = data?.expected ?? [];
  const instruments = data?.instruments ?? new Map<string, InstrumentMeta>();

  const receivedTotal = sum(received.map((item) => money(item.amount)));
  const expectedTotal = sum(expected.map((item) => money(item.estimatedAmount)));

  const forecastBars = useMemo(
    () => expectedByMonth(expected, new Date()),
    [expected],
  );

  const forecastByHolding = useMemo(() => {
    const annual = annualIncomeByInstrument(expected);
    const costByInstrument = new Map(
      (positionsQuery.data?.positions ?? []).map((position) => [
        position.instrumentId,
        position.costBasis.toNumber(),
      ]),
    );
    return [...annual.entries()]
      .map(([instrumentId, income]) => {
        const cost = costByInstrument.get(instrumentId) ?? 0;
        return {
          instrumentId,
          income,
          yieldOnCost: cost > 0 ? income / cost : null,
        };
      })
      .sort((a, b) => b.income - a.income);
  }, [expected, positionsQuery.data]);

  const costOfPayers = forecastByHolding.reduce((total, holding) => {
    const cost = (positionsQuery.data?.positions ?? []).find(
      (position) => position.instrumentId === holding.instrumentId,
    )?.costBasis;
    return total + (cost ? cost.toNumber() : 0);
  }, 0);
  const overallYield =
    costOfPayers > 0 ? expectedTotal.toNumber() / costOfPayers : null;

  const monthlyBars = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        value: 0,
      });
    }
    const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const item of received) {
      const bucket = index.get(item.paidAt.slice(0, 7));
      if (bucket) bucket.value += Number(item.amount);
    }
    return buckets.map(({ label, value }) => ({ label, value }));
  }, [received]);

  const topPayers = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of received) {
      totals.set(
        item.instrumentId,
        (totals.get(item.instrumentId) ?? 0) + Number(item.amount),
      );
    }
    return [...totals.entries()]
      .map(([instrumentId, total]) => ({ instrumentId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [received]);

  const thisYear = new Date().getFullYear().toString();
  const thisYearTotal = sum(
    received
      .filter((item) => item.paidAt.startsWith(thisYear))
      .map((item) => money(item.amount)),
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        Dividends
      </h1>

      <div className="flex gap-1 self-start rounded-[var(--radius-field)] neu-sunken p-1">
        <button
          type="button"
          onClick={() => setTab('received')}
          className={`tap rounded-[var(--radius-field)] px-4 py-1.5 text-sm font-semibold ${
            tab === 'received'
              ? 'neu-flat text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Received
        </button>
        <button
          type="button"
          onClick={() => setTab('expected')}
          className={`tap rounded-[var(--radius-field)] px-4 py-1.5 text-sm font-semibold ${
            tab === 'expected'
              ? 'neu-flat text-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Calendar
        </button>
      </div>

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : tab === 'received' ? (
        <>
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Total received
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--positive)]">
                  {formatEur(receivedTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {thisYear}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-strong)]">
                  {formatEur(thisYearTotal)}
                </p>
              </div>
            </div>
            {received.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  Last 12 months
                </p>
                <DividendsBarChart bars={monthlyBars} />
              </div>
            )}
          </Card>

          {topPayers.length > 0 && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Top payers
              </h2>
              {topPayers.map((payer) => {
                const meta = instruments.get(payer.instrumentId);
                return (
                  <div key={payer.instrumentId} className="flex items-center gap-3">
                    <StockAvatar
                      ticker={meta?.ticker ?? payer.instrumentId}
                      isin={meta?.isin}
                      size={30}
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                      {nameOf(instruments, payer.instrumentId)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--positive)]">
                      {formatEur(money(payer.total))}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}

          {received.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No dividends received yet.
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
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Estimated next 12 months
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-strong)]">
                  {formatEur(expectedTotal)}
                </p>
              </div>
              {overallYield !== null && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Yield on cost
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--accent)]">
                    {percent.format(overallYield)}
                  </p>
                </div>
              )}
            </div>
            {expected.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  Projected by month
                </p>
                <DividendsBarChart bars={forecastBars} />
              </div>
            )}
          </Card>

          {forecastByHolding.length > 0 && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Projected annual income
              </h2>
              {forecastByHolding.slice(0, 8).map((holding) => {
                const meta = instruments.get(holding.instrumentId);
                return (
                  <div
                    key={holding.instrumentId}
                    className="flex items-center gap-3"
                  >
                    <StockAvatar
                      ticker={meta?.ticker ?? holding.instrumentId}
                      isin={meta?.isin}
                      size={30}
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                      {nameOf(instruments, holding.instrumentId)}
                    </span>
                    {holding.yieldOnCost !== null && (
                      <span className="text-xs tabular-nums text-[var(--text-muted)]">
                        {percent.format(holding.yieldOnCost)} YoC
                      </span>
                    )}
                    <span className="w-20 text-right text-sm font-semibold tabular-nums text-[var(--positive)]">
                      ~{formatEur(money(holding.income))}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}

          {expected.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Not enough history to project a calendar.
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
                          estimated · {cadenceLabel[item.cadence]}
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
