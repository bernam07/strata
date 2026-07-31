import type { Slice } from '@/core/analytics/series';

const eur = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const DiversificationBars = ({
  title,
  slices,
}: {
  title: string;
  slices: Slice[];
}) => (
  <div className="flex flex-col gap-3">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
      {title}
    </h3>
    {slices.length === 0 ? (
      <p className="text-sm text-[var(--text-muted)]">No data.</p>
    ) : (
      <ul className="flex flex-col gap-2.5">
        {slices.map((slice) => (
          <li key={slice.group} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[var(--text-strong)]">
                {slice.group}
              </span>
              <span className="tabular-nums text-[var(--text-muted)]">
                {eur.format(slice.value)} · {percent.format(slice.weight)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full neu-sunken">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(slice.weight * 100, 2)}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);
