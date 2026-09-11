import { SegmentedControl } from '@/ui/SegmentedControl';

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
  <SegmentedControl
    value={value}
    onChange={onChange}
    segments={chartRanges}
    fill
    label="Chart range"
  />
);
