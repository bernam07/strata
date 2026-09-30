import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { pct1 as percent } from '@/ui/format';
import { money, sum, toNumber } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import {
  annualIncomeByInstrument,
  expectedByMonth,
} from '@/core/dividends/forecast';
import { Card } from '@/ui/Card';
import { PortfolioNav } from '@/ui/HubNav';
import { PageHeader } from '@/ui/PageHeader';
import { PageHero } from '@/ui/PageHero';
import { Stat } from '@/ui/Stat';
import { SkeletonRows } from '@/ui/Skeleton';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Surface } from '@/ui/Surface';
import { useDividends } from './api/useDividends';
import { DividendsBarChart } from './DividendsBarChart';
import { DividendsHeatmap } from './DividendsHeatmap';
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

const shortDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
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
  const { data, isLoading, isLoadingProfiles } = useDividends();
  const positionsQuery = usePositions();
  const [tab, setTab] = useState<Tab>('expected');

  const received = data?.received ?? [];
  const expected = data?.expected ?? [];
  const instruments = data?.instruments ?? new Map<string, InstrumentMeta>();

  const receivedTotal = sum(received.map((item) => money(item.amount)));
  const expectedTotal = sum(expected.map((item) => money(item.estimatedAmount)));

  const forecastBars = useMemo(
    () =>
      expectedByMonth(expected, new Date()).map((bucket) => {
        const [year, month] = bucket.month.split('-').map(Number);
        return {
          label: bucket.label,
          value: bucket.value,
          full: new Date(year!, month! - 1, 1).toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
          }),
        };
      }),
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
    const buckets: { key: string; label: string; full: string; value: number }[] =
      [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        full: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        value: 0,
      });
    }
    const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const item of received) {
      const bucket = index.get(item.paidAt.slice(0, 7));
      if (bucket) bucket.value += Number(item.amount);
    }
    return buckets.map(({ label, full, value }) => ({ label, full, value }));
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

  const upcomingByMonth = useMemo(() => {
    const sorted = expected
      .slice()
      .sort((a, b) => (a.expectedAt < b.expectedAt ? -1 : 1));
    const groups = new Map<
      string,
      { key: string; label: string; total: number; payouts: typeof expected }
    >();
    for (const item of sorted) {
      const key = item.expectedAt.slice(0, 7);
      const [year, month] = key.split('-').map(Number);
      const label = new Date(year!, month! - 1, 1).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      });
      const group = groups.get(key) ?? {
        key,
        label,
        total: 0,
        payouts: [],
      };
      group.total += Number(item.estimatedAmount);
      group.payouts.push(item);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [expected]);

  const thisYear = new Date().getFullYear().toString();
  const thisYearTotal = sum(
    received
      .filter((item) => item.paidAt.startsWith(thisYear))
      .map((item) => money(item.amount)),
  );

  return (
    <div className="flex flex-col gap-6">
      <PortfolioNav />

      <PageHeader
        title="Dividends"
        subtitle="Income received and what's on the way."
        actions={
          <div className="flex items-center gap-2">
            {isLoadingProfiles && (
              <span className="hidden text-[11px] font-medium text-[var(--text-muted)] sm:inline">
                Checking dates…
              </span>
            )}
            <SegmentedControl
              value={tab}
              onChange={setTab}
              segments={[
                { value: 'expected', label: 'Upcoming Calendar' },
                { value: 'received', label: 'Received' },
              ]}
              size="sm"
              label="Dividend view"
            />
          </div>
        }
      />

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : tab === 'received' ? (
        <>
          {expected.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-raised)] p-3.5 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <StockAvatar
                  ticker={
                    instruments.get(expected[0]!.instrumentId)?.ticker ??
                    expected[0]!.instrumentId
                  }
                  isin={instruments.get(expected[0]!.instrumentId)?.isin}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      Next Payout
                    </span>
                    {expected[0]!.confirmedDate && (
                      <span className="rounded bg-[color-mix(in_srgb,var(--positive)_18%,transparent)] px-1 py-0.2 text-[9px] font-bold uppercase text-[var(--positive)]">
                        Confirmed
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs font-semibold text-[var(--text-strong)]">
                    {nameOf(instruments, expected[0]!.instrumentId)} ·{' '}
                    {dateFormat.format(new Date(expected[0]!.expectedAt))}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold tabular-nums text-[var(--positive)]">
                  ~<AmountInline value={Number(expected[0]!.estimatedAmount)} />
                </span>
                <button
                  type="button"
                  onClick={() => setTab('expected')}
                  className="tap rounded-[var(--radius-field)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  View calendar →
                </button>
              </div>
            </div>
          )}

          <PageHero
            label="Total received"
            value={toNumber(receivedTotal)}
            aside={
              <Stat
                label={thisYear}
                value={<AmountInline value={toNumber(thisYearTotal)} />}
                hint="received this year"
              />
            }
          >
            {received.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Last 12 months
                </p>
                <DividendsBarChart bars={monthlyBars} />
              </div>
            )}
          </PageHero>

          {received.length > 0 && (
            <DividendsHeatmap
              mode="received"
              received={received}
              expected={expected}
              instruments={instruments}
            />
          )}

          {topPayers.length > 0 && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Top payers
              </h2>
              {topPayers.map((payer) => {
                const meta = instruments.get(payer.instrumentId);
                return (
                  <Link
                    key={payer.instrumentId}
                    to={`/positions/${payer.instrumentId}`}
                    className="tap flex items-center gap-3 rounded-[var(--radius-field)] p-1 transition hover:bg-[var(--surface-flat)]"
                  >
                    <StockAvatar
                      ticker={meta?.ticker ?? payer.instrumentId}
                      isin={meta?.isin}
                      size={30}
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                      {nameOf(instruments, payer.instrumentId)}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--positive)]">
                      <AmountInline value={payer.total} />
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">→</span>
                  </Link>
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
              {received.map((item) => {
                const meta = instruments.get(item.instrumentId);
                return (
                  <li key={item.id}>
                    <Link
                      to={`/positions/${item.instrumentId}`}
                      className="tap block"
                    >
                      <Surface
                        elevation="flat"
                        className="flex items-center gap-3.5 p-4 transition hover:bg-[var(--surface-flat)]"
                      >
                        <StockAvatar
                          ticker={meta?.ticker ?? item.instrumentId}
                          isin={meta?.isin}
                          size={34}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                            {nameOf(instruments, item.instrumentId)}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {dateFormat.format(new Date(item.paidAt))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-[var(--positive)]">
                            <AmountInline value={Number(item.amount)} />
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">→</span>
                        </div>
                      </Surface>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <PageHero
            label="Estimated next 12 months"
            value={toNumber(expectedTotal)}
            aside={
              overallYield !== null ? (
                <Stat
                  label="Yield on cost"
                  value={percent.format(overallYield)}
                  hint="across paying holdings"
                />
              ) : undefined
            }
          >
            {expected.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Projected by month
                </p>
                <DividendsBarChart bars={forecastBars} />
              </div>
            )}
          </PageHero>

          {expected.length > 0 && (
            <DividendsHeatmap
              mode="expected"
              received={received}
              expected={expected}
              instruments={instruments}
            />
          )}

          {forecastByHolding.length > 0 && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Projected annual income by holding
                </h2>
                <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {forecastByHolding.length} payers
                </span>
              </div>
              {forecastByHolding.slice(0, 10).map((holding) => {
                const meta = instruments.get(holding.instrumentId);
                return (
                  <Link
                    key={holding.instrumentId}
                    to={`/positions/${holding.instrumentId}`}
                    className="tap flex items-center gap-3 rounded-[var(--radius-field)] p-1 transition hover:bg-[var(--surface-flat)]"
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
                    <div className="flex items-center gap-2">
                      <span className="text-right text-sm font-semibold tabular-nums text-[var(--positive)]">
                        ~<AmountInline value={holding.income} />
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">→</span>
                    </div>
                  </Link>
                );
              })}
            </Card>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Upcoming Payout Schedule
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Expected dividends grouped by month & payout date
                </p>
              </div>
              <span className="text-xs font-bold tabular-nums text-[var(--accent)]">
                {expected.length} total payments
              </span>
            </div>

            {upcomingByMonth.length === 0 ? (
              <Card>
                <p className="text-sm text-[var(--text-muted)]">
                  No upcoming dividends detected in your active holdings.
                </p>
              </Card>
            ) : (
              upcomingByMonth.map((group) => (
                <Card key={group.key} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--text-strong)]">
                        {group.label}
                      </h3>
                      <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                        {group.payouts.length}{' '}
                        {group.payouts.length === 1 ? 'payout' : 'payouts'}
                      </span>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-[var(--positive)]">
                      ~<AmountInline value={group.total} />
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2">
                    {group.payouts.map((item, index) => {
                      const meta = instruments.get(item.instrumentId);
                      const expectedDate = new Date(item.expectedAt);
                      const now = new Date();
                      const todayStart = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                      );
                      const targetStart = new Date(
                        expectedDate.getFullYear(),
                        expectedDate.getMonth(),
                        expectedDate.getDate(),
                      );
                      const diffDays = Math.round(
                        (targetStart.getTime() - todayStart.getTime()) /
                          (1000 * 60 * 60 * 24),
                      );
                      const relativeLabel =
                        diffDays <= 0
                          ? 'Today'
                          : diffDays === 1
                            ? 'Tomorrow'
                            : `in ${diffDays}d`;

                      return (
                        <li key={`${item.instrumentId}-${item.expectedAt}-${index}`}>
                          <Link
                            to={`/positions/${item.instrumentId}`}
                            className="tap block"
                          >
                            <Surface
                              elevation="flat"
                              className="flex items-center gap-3.5 p-3.5 transition hover:bg-[var(--surface-flat)]"
                            >
                              <StockAvatar
                                ticker={meta?.ticker ?? item.instrumentId}
                                isin={meta?.isin}
                                size={34}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                                    {nameOf(instruments, item.instrumentId)}
                                  </p>
                                  {item.confirmedDate && (
                                    <span className="rounded bg-[color-mix(in_srgb,var(--positive)_18%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--positive)]">
                                      Confirmed date
                                    </span>
                                  )}
                                  <span className="rounded-full neu-sunken px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    {cadenceLabel[item.cadence]}
                                  </span>
                                </div>
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                  <span>{dateFormat.format(expectedDate)}</span>
                                  <span>·</span>
                                  <span className="font-semibold text-[var(--accent)]">
                                    {relativeLabel}
                                  </span>
                                  {item.exDividendAt && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[var(--text-2)]">
                                        Ex-div{' '}
                                        {shortDateFormat.format(
                                          new Date(item.exDividendAt),
                                        )}
                                      </span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold tabular-nums text-[var(--positive)]">
                                  ~<AmountInline value={Number(item.estimatedAmount)} />
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">→</span>
                              </div>
                            </Surface>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
