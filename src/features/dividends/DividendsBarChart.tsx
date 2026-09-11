import { useState } from 'react';
import { AmountInline } from '@/ui/Amount';

export interface Bar {
  label: string;
  value: number;
  /** Longer label for the read-out, e.g. "March 2026". */
  full?: string;
}

// Bars are absolutely positioned inside a fixed-height plot rather than sized
// by a chain of percentage heights through three flex parents — that chain
// collapsed whenever the chart was placed in a new wrapper. Tapping a bar
// reads out its month; tapping it again clears.
const PLOT_HEIGHT = 140;

export const DividendsBarChart = ({ bars }: { bars: Bar[] }) => {
  const [selected, setSelected] = useState<number | null>(null);
  if (bars.length === 0) return null;

  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const active = selected !== null ? bars[selected] : null;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative flex items-end gap-1.5"
        style={{ height: PLOT_HEIGHT }}
      >
        {bars.map((bar, index) => {
          const isActive = selected === index;
          const height = Math.round(
            (bar.value / max) * PLOT_HEIGHT * 0.94 + (bar.value > 0 ? 3 : 0),
          );
          return (
            <button
              key={bar.label + index}
              type="button"
              onClick={() => setSelected(isActive ? null : index)}
              aria-label={`${bar.full ?? bar.label}: ${bar.value.toFixed(2)} euro`}
              className="tap flex h-full flex-1 items-end"
            >
              <span
                className="block w-full rounded-t-md"
                style={{
                  height: `${height}px`,
                  opacity: selected === null || isActive ? 1 : 0.4,
                  outline: isActive ? '1.5px solid var(--accent)' : undefined,
                  background:
                    bar.value > 0
                      ? 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent))'
                      : 'var(--surface-flat)',
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {bars.map((bar, index) => (
          <span
            key={bar.label + index}
            className={`flex-1 text-center text-[9px] font-semibold ${
              selected === index
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {bar.label}
          </span>
        ))}
      </div>

      <p className="min-h-[1.25rem] text-xs text-[var(--text-muted)]">
        {active ? (
          <>
            <span className="font-semibold text-[var(--text-2)]">
              {active.full ?? active.label}
            </span>
            {' · '}
            <AmountInline value={active.value} />
          </>
        ) : (
          'Tap a bar for that month.'
        )}
      </p>
    </div>
  );
};
