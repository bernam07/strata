import { useMemo } from 'react';
import type { Transaction } from '@/core/types';

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Spend over the trailing seven days as a small bar chart, with a dashed line
// at the daily average. Bars under the average read positive (green); bars over
// it read as overspend (amber) — the same cue the target line carries. The plot
// and the day labels are separate rows so the target line lines up with the
// bars exactly.
export const WeeklySpend = ({ transactions }: { transactions: Transaction[] }) => {
  const model = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (6 - offset),
      );
      return {
        key: date.toISOString().slice(0, 10),
        letter: DAY_LETTER[date.getDay()]!,
        total: 0,
      };
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense' && transaction.kind !== 'fee') continue;
      const day = byKey.get(transaction.occurredAt.slice(0, 10));
      if (day) day.total += Math.abs(Number(transaction.amount));
    }
    const max = Math.max(...days.map((day) => day.total), 1);
    const total = days.reduce((sum, day) => sum + day.total, 0);
    return { days, max, avg: total / 7 };
  }, [transactions]);

  const targetPct = Math.min(96, (model.avg / model.max) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-32">
        {model.avg > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{
              bottom: `${targetPct}%`,
              borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)',
            }}
          >
            <span className="absolute right-0 top-[-9px] bg-[var(--surface-raised)] px-1 text-[9.5px] font-bold text-[var(--accent)]">
              {grouped.format(Math.round(model.avg))} €/day
            </span>
          </div>
        )}
        <div className="flex h-full items-end gap-2">
          {model.days.map((day) => {
            const height = (day.total / model.max) * 100;
            const over = day.total > model.avg && model.avg > 0;
            return (
              <div key={day.key} className="flex h-full flex-1 justify-center">
                <div className="relative h-full w-full max-w-[22px] overflow-hidden rounded-lg neu-sunken">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-lg"
                    style={{
                      height: `${Math.max(height, 3)}%`,
                      background:
                        day.total === 0
                          ? 'var(--surface-flat)'
                          : over
                            ? 'linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 45%, black))'
                            : 'linear-gradient(var(--positive), color-mix(in srgb, var(--positive) 45%, black))',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        {model.days.map((day, index) => (
          <span
            key={day.key}
            className="flex-1 text-center text-[9.5px] font-semibold text-[var(--text-muted)]"
          >
            {day.letter}
            <span className="sr-only"> day {index + 1}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
