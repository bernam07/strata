import { AmountInline } from './Amount';

// The change chip that sits beside a headline figure. Tone is explicit rather
// than derived from the sign: a rise in spending is bad, a rise in net worth is
// good, and only the caller knows which it is looking at.
export const DeltaPill = ({
  value,
  tone,
  note,
}: {
  value: number;
  tone: 'positive' | 'negative';
  note?: string;
}) => {
  const color = tone === 'positive' ? 'var(--positive)' : 'var(--negative)';
  return (
    <span
      className="flex w-fit items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-bold"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
      }}
    >
      {value < 0 ? '▼' : '▲'} <AmountInline value={Math.abs(value)} />
      {note && <span className="font-semibold opacity-70">{note}</span>}
    </span>
  );
};
