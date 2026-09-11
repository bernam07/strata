import { CATEGORY_COLORS } from './categoryColors';

const swatchClass = (selected: boolean): string =>
  `tap h-5 w-5 rounded-full border ${
    selected
      ? 'outline outline-2 outline-offset-2 outline-[var(--accent)]'
      : 'opacity-80 hover:opacity-100'
  }`;

// Colour picker for a category: the neutral default plus the presets. Shared by
// the category manager and the inline editor behind a tile, so a colour set in
// one place looks the same in the other.
export const ColorSwatches = ({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
}) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      onClick={() => onChange(null)}
      title="Default (neutral)"
      aria-label="Default (neutral)"
      aria-pressed={value === null}
      className={swatchClass(value === null)}
      style={{ background: 'var(--surface-sunken)', borderColor: 'var(--line)' }}
    />
    {CATEGORY_COLORS.map((swatch) => (
      <button
        key={swatch.hex}
        type="button"
        onClick={() => onChange(swatch.hex)}
        title={swatch.name}
        aria-label={swatch.name}
        aria-pressed={value === swatch.hex}
        className={swatchClass(value === swatch.hex)}
        style={{ background: swatch.hex, borderColor: 'transparent' }}
      />
    ))}
  </div>
);
