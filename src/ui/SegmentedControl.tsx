// The app's one segmented control: a sunken track holding mutually exclusive
// options, the active one raised and tinted with the accent. Every range /
// tab / toggle strip in the app renders through this so they stay identical.

export interface Segment<T extends string> {
  value: T;
  label: string;
}

const padding = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
} as const;

export const SegmentedControl = <T extends string>({
  value,
  segments,
  onChange,
  size = 'sm',
  fill = false,
  className = '',
  label,
}: {
  value: T;
  segments: readonly Segment<T>[];
  onChange: (value: T) => void;
  size?: keyof typeof padding;
  /** Stretch the options to fill the track evenly. */
  fill?: boolean;
  className?: string;
  label?: string;
}) => (
  <div
    role="group"
    aria-label={label}
    className={`flex gap-1 rounded-[var(--radius-field)] neu-sunken p-1 ${className}`}
  >
    {segments.map((segment) => {
      const active = segment.value === value;
      return (
        <button
          key={segment.value}
          type="button"
          onClick={() => onChange(segment.value)}
          aria-pressed={active}
          className={`tap rounded-[var(--radius-field)] font-semibold ${padding[size]} ${
            fill ? 'flex-1' : ''
          } ${
            active
              ? 'neu-flat text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'
          }`}
        >
          {segment.label}
        </button>
      );
    })}
  </div>
);
