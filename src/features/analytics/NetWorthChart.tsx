import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '@/core/analytics/series';

const eur = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const monthDay = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

interface TooltipPayload {
  payload: SeriesPoint;
}

const ChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-[var(--radius-neu-sm)] neu-raised px-3 py-2 text-xs">
      <p className="text-[var(--text-muted)]">
        {new Date(point.date).toLocaleDateString('en-GB')}
      </p>
      <p className="font-semibold tabular-nums text-[var(--text-strong)]">
        {eur.format(point.value)}
      </p>
    </div>
  );
};

export const NetWorthChart = ({ series }: { series: SeriesPoint[] }) => {
  if (series.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-[var(--text-muted)]">
        Not enough data for this period.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="networth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--text-muted)" strokeOpacity={0.12} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => monthDay.format(new Date(value))}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tickFormatter={(value: number) => eur.format(value)}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.4 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={2}
          fill="url(#networth)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
