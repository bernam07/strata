import { AmountInline } from '@/ui/Amount';
import { Card } from '@/ui/Card';
import { pctMax1 } from '@/ui/format';

interface LayerItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export const WealthLayersBar = ({
  investments,
  cash,
  meal,
  crypto,
}: {
  investments: number;
  cash: number;
  meal: number;
  crypto: number;
}) => {
  const raw: LayerItem[] = [
    {
      id: 'investments',
      label: 'Investments',
      value: Math.max(0, investments),
      color: 'var(--accent)',
    },
    {
      id: 'cash',
      label: 'Liquid cash',
      value: Math.max(0, cash),
      color: '#4fb286',
    },
    {
      id: 'meal',
      label: 'Meal card',
      value: Math.max(0, meal),
      color: '#F72717',
    },
    {
      id: 'crypto',
      label: 'Crypto',
      value: Math.max(0, crypto),
      color: '#7c8bff',
    },
  ].filter((item) => item.value > 0);

  const total = raw.reduce((acc, item) => acc + item.value, 0);
  if (total <= 0 || raw.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3.5 lg:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Wealth layers
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          Liquidity vs. invested capital
        </span>
      </div>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)] p-0.5 gap-0.5">
        {raw.map((layer) => {
          const pct = Math.max(2, (layer.value / total) * 100);
          return (
            <div
              key={layer.id}
              style={{
                width: `${pct}%`,
                background: layer.color,
              }}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
              title={`${layer.label}: ${pctMax1.format(layer.value / total)}`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {raw.map((layer) => {
          const weight = layer.value / total;
          return (
            <div
              key={layer.id}
              className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2"
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: layer.color }}
                  />
                  <span className="truncate text-[11px] font-semibold text-[var(--text-muted)]">
                    {layer.label}
                  </span>
                </div>
                <span className="text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
                  {pctMax1.format(weight)}
                </span>
              </div>
              <span className="text-sm font-bold text-[var(--text-strong)]">
                <AmountInline value={layer.value} />
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
