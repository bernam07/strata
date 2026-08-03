export interface ChartRange {
  label: string;
  value: string;
}

export const chartRanges: ChartRange[] = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

export const RangeTabs = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (range: string) => void;
}) => (
  <div className="flex gap-1 rounded-[var(--radius-field)] neu-sunken p-1">
    {chartRanges.map((range) => (
      <button
        key={range.value}
        type="button"
        onClick={() => onChange(range.value)}
        className={`tap flex-1 rounded-[var(--radius-field)] px-2 py-1 text-xs font-semibold ${
          value === range.value
            ? 'neu-flat text-[var(--accent)]'
            : 'text-[var(--text-muted)]'
        }`}
      >
        {range.label}
      </button>
    ))}
  </div>
);
