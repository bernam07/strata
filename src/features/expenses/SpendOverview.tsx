import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computePaydayCycle,
  usePaydayCycle,
  type PaydayConfig,
} from '@/core/payday/paydayCycle';
import type { Transaction } from '@/core/types';
import { AmountInline } from '@/ui/Amount';
import { PageHero } from '@/ui/PageHero';
import { DeltaPill } from '@/ui/DeltaPill';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { dayMonth } from '@/ui/format';

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dayFull = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
});

type Range = 'week' | 'cycle' | 'month' | '6m';

const RANGES: { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'cycle', label: 'Pay cycle' },
  { value: 'month', label: 'Month' },
  { value: '6m', label: '6 months' },
];

interface BucketItem {
  id: string;
  note: string;
  amount: number;
}

interface Bucket {
  key: string;
  label: string;
  full: string;
  showLabel: boolean;
  total: number;
  items: BucketItem[];
}

const pad = (value: number) => String(value).padStart(2, '0');
// Format from local date parts: `toISOString` would shift the day for anyone
// east or west of UTC, and the ledger is compared by its leading date slice.
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const isoMonth = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const buildBuckets = (
  range: Range,
  offset: number,
  paydayConfig: PaydayConfig,
): Bucket[] => {
  const now = new Date();

  if (range === 'week') {
    const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    anchor.setDate(anchor.getDate() - offset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() - (6 - index));
      return {
        key: isoDay(date),
        label: DAY_LETTER[date.getDay()]!,
        full: dayFull.format(date),
        showLabel: true,
        total: 0,
        items: [],
      };
    });
  }

  if (range === 'cycle') {
    let cycle = computePaydayCycle(now, paydayConfig);
    for (let i = 0; i < offset; i += 1) {
      const [y = 0, m = 1, d = 1] = cycle.cycleStartIso.split('-').map(Number);
      const prevAnchor = new Date(y, m - 1, d - 1, 12, 0, 0);
      cycle = computePaydayCycle(prevAnchor, paydayConfig);
    }
    const [sy, sm, sd] = cycle.cycleStartIso.split('-').map(Number);
    const [ey, em, ed] = cycle.cycleEndIso.split('-').map(Number);
    const start = new Date(sy!, sm! - 1, sd!, 12, 0, 0);
    const end = new Date(ey!, em! - 1, ed!, 12, 0, 0);
    const buckets: Bucket[] = [];
    const cursor = new Date(start);
    let idx = 0;
    while (cursor <= end && idx < 45) {
      const dayNum = cursor.getDate();
      buckets.push({
        key: isoDay(cursor),
        label: String(dayNum),
        full: dayFull.format(cursor),
        showLabel: idx === 0 || idx % 7 === 0,
        total: 0,
        items: [],
      });
      cursor.setDate(cursor.getDate() + 1);
      idx += 1;
    }
    return buckets;
  }

  if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const count = new Date(
      first.getFullYear(),
      first.getMonth() + 1,
      0,
    ).getDate();
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), index + 1);
      const dayNumber = index + 1;
      return {
        key: isoDay(date),
        label: String(dayNumber),
        full: dayFull.format(date),
        // A label under every day would be unreadable on a phone; mark out the
        // weeks instead.
        showLabel: dayNumber === 1 || dayNumber % 7 === 1,
        total: 0,
        items: [],
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset * 6 - (5 - index),
      1,
    );
    return {
      key: isoMonth(date),
      label: monthShort.format(date),
      full: monthLong.format(date),
      showLabel: true,
      total: 0,
      items: [],
    };
  });
};

const fillBuckets = (
  buckets: Bucket[],
  transactions: Transaction[],
  range: Range,
): Bucket[] => {
  const sliceLength = range === '6m' ? 7 : 10;
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' && transaction.kind !== 'fee') continue;
    const bucket = byKey.get(transaction.occurredAt.slice(0, sliceLength));
    if (bucket) {
      const amount = Math.abs(Number(transaction.amount));
      bucket.total += amount;
      bucket.items.push({
        id: transaction.id,
        note: transaction.note || (transaction.kind === 'fee' ? 'Fee' : 'Expense'),
        amount,
      });
    }
  }
  for (const bucket of buckets) {
    bucket.items.sort((a, b) => b.amount - a.amount);
  }
  return buckets;
};

const periodLabel = (range: Range, buckets: Bucket[]): string => {
  if (buckets.length === 0) return '';
  if (range === 'month') {
    const [year, month] = buckets[0]!.key.split('-').map(Number);
    return monthLong.format(new Date(year!, month! - 1, 1));
  }
  const first = buckets[0]!;
  const last = buckets[buckets.length - 1]!;
  if (range === '6m') return `${first.label} – ${last.full}`;
  const toDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  };
  return `${dayMonth.format(toDate(first.key))} – ${dayMonth.format(toDate(last.key))}`;
};

export const SpendOverview = ({
  transactions,
  preferredRange,
}: {
  transactions: Transaction[];
  preferredRange?: 'cycle' | 'month';
}) => {
  const [range, setRange] = useState<Range>(preferredRange ?? 'week');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const { config: paydayConfig } = usePaydayCycle();
  const plotRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  // A drag selects as the finger moves; the click that follows pointerup would
  // otherwise toggle the same bar straight back off, so it is swallowed once.
  const dragged = useRef(false);

  useEffect(() => {
    if (!preferredRange) return;
    setRange(preferredRange);
    setOffset(0);
    setSelected(null);
  }, [preferredRange]);

  const model = useMemo(() => {
    const buckets = fillBuckets(
      buildBuckets(range, offset, paydayConfig),
      transactions,
      range,
    );
    const previous = fillBuckets(
      buildBuckets(range, offset + 1, paydayConfig),
      transactions,
      range,
    );
    const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
    const previousTotal = previous.reduce((sum, bucket) => sum + bucket.total, 0);
    const max = Math.max(...buckets.map((bucket) => bucket.total), 1);
    return {
      buckets,
      total,
      previousTotal,
      max,
      average: total / buckets.length,
      label: periodLabel(range, buckets),
    };
  }, [range, offset, transactions, paydayConfig]);

  // Selection can outlive a range change (a month has more bars than a week).
  const active =
    selected !== null && selected < model.buckets.length
      ? model.buckets[selected]!
      : null;

  const delta = model.total - model.previousTotal;
  const spendUp = delta > 0;

  const pickFromPointer = (clientX: number) => {
    const plot = plotRef.current;
    if (!plot) return;
    const rect = plot.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const index = Math.floor(ratio * model.buckets.length);
    if (index >= 0 && index < model.buckets.length) setSelected(index);
  };

  const step = (direction: number) => {
    setOffset((current) => Math.max(0, current + direction));
    setSelected(null);
  };

  const changeRange = (next: Range) => {
    setRange(next);
    setOffset(0);
    setSelected(null);
  };

  const targetPct = Math.min(96, (model.average / model.max) * 100);

  return (
    <PageHero
      label={active ? active.full : model.label}
      value={active ? active.total : model.total}
      toolbar={
        <>
          <SegmentedControl
            value={range}
            onChange={changeRange}
            segments={RANGES}
            label="Chart range"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Previous period"
              className="tap grid h-7 w-7 place-items-center rounded-[var(--radius-field)] neu-flat text-[var(--text-2)]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={offset === 0}
              aria-label="Next period"
              className="tap grid h-7 w-7 place-items-center rounded-[var(--radius-field)] neu-flat text-[var(--text-2)] disabled:opacity-35"
            >
              ›
            </button>
          </div>
        </>
      }
      aside={
        active ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="tap text-xs font-semibold text-[var(--accent)]"
          >
            Show period total
          </button>
        ) : model.previousTotal > 0 ? (
          <DeltaPill
            value={delta}
            tone={spendUp ? 'negative' : 'positive'}
            note="vs previous"
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1.5">
        <div
          ref={plotRef}
          className="relative h-32 touch-none"
          onPointerDown={(event) => {
            scrubbing.current = true;
            dragged.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!scrubbing.current) return;
            dragged.current = true;
            pickFromPointer(event.clientX);
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
          onPointerCancel={() => {
            scrubbing.current = false;
            dragged.current = false;
          }}
        >
          {model.average > 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed"
              style={{
                bottom: `${targetPct}%`,
                borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)',
              }}
            >
              <span className="absolute right-0 top-[-9px] bg-[var(--surface-raised)] px-1 text-[9.5px] font-bold tabular-nums text-[var(--accent)]">
                {grouped.format(Math.round(model.average))} € avg
              </span>
            </div>
          )}
          <div
            className={`flex h-full items-end ${range === 'month' || range === 'cycle' ? 'gap-[3px]' : 'gap-2'}`}
          >
            {model.buckets.map((bucket, index) => {
              const height = (bucket.total / model.max) * 100;
              const over = bucket.total > model.average && model.average > 0;
              const isActive = selected === index;
              return (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => {
                    if (dragged.current) {
                      dragged.current = false;
                      return;
                    }
                    setSelected(isActive ? null : index);
                  }}
                  aria-label={`${bucket.full}: ${Math.round(bucket.total)} euro`}
                  className="flex h-full flex-1 justify-center rounded-lg"
                >
                  <span
                    className={`relative h-full w-full overflow-hidden rounded-lg neu-sunken ${
                      range === 'month' || range === 'cycle' ? '' : 'max-w-[22px]'
                    }`}
                    style={{
                      outline: isActive
                        ? '1.5px solid var(--accent)'
                        : undefined,
                      outlineOffset: '1px',
                    }}
                  >
                    <span
                      className="absolute inset-x-0 bottom-0 block rounded-lg"
                      style={{
                        height: `${Math.max(height, 3)}%`,
                        opacity: selected === null || isActive ? 1 : 0.45,
                        background:
                          bucket.total === 0
                            ? 'var(--surface-flat)'
                            : over
                              ? 'linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 45%, black))'
                              : 'linear-gradient(var(--positive), color-mix(in srgb, var(--positive) 45%, black))',
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          className={`flex ${range === 'month' || range === 'cycle' ? 'gap-[3px]' : 'gap-2'}`}
          aria-hidden="true"
        >
          {model.buckets.map((bucket, index) => (
            <span
              key={bucket.key}
              className={`flex-1 text-center text-[9.5px] font-semibold ${
                selected === index
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {bucket.showLabel ? bucket.label : ' '}
            </span>
          ))}
        </div>

        {active && active.items.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-2.5">
            {active.items.slice(0, 4).map((item) => (
              <span
                key={item.id}
                className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-[11px]"
              >
                <span className="truncate font-semibold text-[var(--text-strong)]">
                  {item.note}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-[var(--negative)]">
                  <AmountInline value={item.amount} />
                </span>
              </span>
            ))}
            {active.items.length > 4 && (
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                +{active.items.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </PageHero>
  );
};
