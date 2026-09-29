import { useMemo } from 'react';
import {
  compoundMonthlyCost,
  detectHabitLeaks,
  monthlyEquivalent,
  type RecurringExpense,
} from '@/core/expenses/recurring';
import { toNumber } from '@/core/money/money';
import type { Transaction } from '@/core/types';
import { AmountInline } from '@/ui/Amount';
import { Card } from '@/ui/Card';
import { pct0 } from '@/ui/format';

const nextDateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

export const SubscriptionLeakCard = ({
  recurring,
  transactions,
}: {
  recurring: readonly RecurringExpense[];
  transactions: readonly Transaction[];
}) => {
  const analysis = useMemo(() => {
    const enriched = recurring.map((item) => {
      const monthly = toNumber(monthlyEquivalent(item));
      const annual = monthly * 12;
      const tenYear = compoundMonthlyCost(monthly, 10, 0.08);
      return {
        ...item,
        monthly,
        annual,
        tenYear,
      };
    });

    const totalMonthly = enriched.reduce((acc, item) => acc + item.monthly, 0);
    const totalAnnual = totalMonthly * 12;
    const totalTenYear = compoundMonthlyCost(totalMonthly, 10, 0.08);
    const priceHikes = enriched.filter((item) => item.priceCreep !== null);

    const recurringSet = new Set(
      recurring.map((r) => r.label.trim().toLowerCase().replace(/\s+/g, ' ')),
    );
    const habitLeaks = detectHabitLeaks(transactions, recurringSet);

    return {
      enriched,
      totalMonthly,
      totalAnnual,
      totalTenYear,
      priceHikes,
      habitLeaks,
    };
  }, [recurring, transactions]);

  if (analysis.enriched.length === 0 && analysis.habitLeaks.length === 0) {
    return null;
  }

  return (
    <Card className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Subscription & Leak Finder
            </h2>
            {analysis.priceHikes.length > 0 && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--negative)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--negative)]">
                {analysis.priceHikes.length} price{' '}
                {analysis.priceHikes.length === 1 ? 'hike' : 'hikes'}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Recurring charges, price creep alerts & 10-year cost at 8% p.a.
          </p>
        </div>
        {analysis.totalAnnual > 0 && (
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[var(--accent)]">
            ~<AmountInline value={analysis.totalAnnual} />
            /yr
          </span>
        )}
      </div>

      {/* 3-Column Summary Strip */}
      {analysis.enriched.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Monthly
            </span>
            <span className="truncate text-sm font-bold text-[var(--text-strong)]">
              <AmountInline value={analysis.totalMonthly} />
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Annual burn
            </span>
            <span className="truncate text-sm font-bold text-[var(--negative)]">
              <AmountInline value={analysis.totalAnnual} />
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
            <span
              className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              title="Future value if invested monthly at 8% p.a. for 10 years"
            >
              10Y @ 8%
            </span>
            <span className="truncate text-sm font-bold text-[var(--accent)]">
              <AmountInline value={analysis.totalTenYear} />
            </span>
          </div>
        </div>
      )}

      {/* Price Creep Alert Banner */}
      {analysis.priceHikes.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-field)] border border-[var(--negative)]/35 bg-[color-mix(in_srgb,var(--negative)_10%,var(--surface-raised))] p-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--negative)]">
            ⚠️ Price increase detected
          </span>
          {analysis.priceHikes.map((item) => (
            <div
              key={item.label}
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="font-semibold text-[var(--text-strong)]">
                {item.label}
              </span>
              <span className="tabular-nums text-[var(--text-2)]">
                <AmountInline value={item.priceCreep!.previousAmount} /> →{' '}
                <strong className="text-[var(--negative)]">
                  <AmountInline value={item.priceCreep!.latestAmount} />
                </strong>{' '}
                <span className="text-[var(--negative)]">
                  (+{pct0.format(item.priceCreep!.deltaPct)})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Subscriptions List with 10Y Opportunity Cost */}
      {analysis.enriched.length > 0 && (
        <ul className="flex flex-col gap-2">
          {analysis.enriched.map((item) => (
            <li
              key={item.label}
              className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-field)] neu-flat px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                    {item.label}
                  </p>
                  {item.priceCreep && (
                    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--negative)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--negative)]">
                      ▲ +<AmountInline value={item.priceCreep.deltaAmount} />
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {item.cadence} · next{' '}
                  {nextDateFmt.format(new Date(item.nextExpected))} ·{' '}
                  <AmountInline value={item.annual} />
                  /yr
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-bold tabular-nums text-[var(--text-strong)]">
                  <AmountInline value={toNumber(item.latestAmount)} />
                </span>
                <span
                  className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--accent)]"
                  title="Opportunity cost over 10 years if invested at 8% p.a."
                >
                  10Y: <AmountInline value={item.tenYear} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Habitual Micro-Leaks (30d repeat spend) */}
      {analysis.habitLeaks.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)]/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Frequent 30-day micro-leaks
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              3+ charges this month
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {analysis.habitLeaks.map((leak) => (
              <div
                key={leak.label}
                className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-field)] bg-[var(--surface-sunken)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[var(--text-strong)]">
                    {leak.label}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {leak.countLast30d}× in last 30 days
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-xs font-bold tabular-nums text-[var(--negative)]">
                    <AmountInline value={leak.totalLast30d} />
                    /mo
                  </span>
                  <span className="text-[10px] tabular-nums text-[var(--text-muted)]">
                    10Y @ 8%: <AmountInline value={leak.tenYearCost} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
