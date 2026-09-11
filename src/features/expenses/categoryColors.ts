// One source of truth for category colour, shared by the tiles and the picker.
//
// A category has no colour by default: every tile then renders the same muted
// neutral, and colour only appears where the user deliberately put it. The
// presets are mixed into the surface token rather than used flat, so a chosen
// colour reads as a deep tint in dark mode and a soft pastel in light mode.

export interface CategoryColor {
  /** Stored value — a plain 6-digit lowercase hex, matching the DB constraint. */
  hex: string;
  name: string;
}

export const CATEGORY_COLORS: CategoryColor[] = [
  { hex: '#52c48c', name: 'Mint' },
  { hex: '#6aa6e0', name: 'Blue' },
  { hex: '#c58fd6', name: 'Plum' },
  { hex: '#e0a44a', name: 'Amber' },
  { hex: '#ef6b78', name: 'Rust' },
  { hex: '#9fce5f', name: 'Olive' },
];

export interface TileStyle {
  background: string;
  border: string;
  chipBackground: string;
  chipColor: string;
  dot: string;
}

/** Surface treatment for a category, neutral when it has no colour set. */
export const tileStyle = (color: string | null): TileStyle => {
  if (!color) {
    return {
      background: 'var(--surface-flat)',
      border: '1px solid var(--line)',
      chipBackground: 'var(--surface-sunken)',
      chipColor: 'var(--text-muted)',
      dot: 'var(--text-muted)',
    };
  }
  return {
    background: `color-mix(in srgb, ${color} 13%, var(--surface-flat))`,
    border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
    chipBackground: `color-mix(in srgb, ${color} 26%, transparent)`,
    chipColor: color,
    dot: color,
  };
};
