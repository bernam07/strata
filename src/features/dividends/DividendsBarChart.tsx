import { eur0 as eur } from '@/ui/format';

export interface Bar {
  label: string;
  value: number;
}

export const DividendsBarChart = ({ bars }: { bars: Bar[] }) => {
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height: 140 }}>
      {bars.map((bar) => (
        <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 4 : 0)}%`,
                background:
                  'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent))',
              }}
              title={`${bar.label}: ${eur.format(bar.value)}`}
            />
          </div>
          <span className="text-[9px] text-[var(--text-muted)]">{bar.label}</span>
        </div>
      ))}
    </div>
  );
};
