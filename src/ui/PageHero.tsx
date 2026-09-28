import type { ReactNode } from 'react';
import { Amount } from './Amount';
import { togglePrivacy } from './privacy';

// The shape every main page opens with: a small eyebrow label, one large
// figure, and an optional change chip — with room for controls above and a
// chart or breakdown below. Using one component keeps the pages recognisably
// the same screen rather than six variations on a headline.
export const PageHero = ({
  label,
  value,
  sub,
  aside,
  toolbar,
  children,
}: {
  label: string;
  value: number;
  /** A quieter line under the figure, e.g. a breakdown. */
  sub?: ReactNode;
  /** Right-hand block: a change chip, or secondary figures. */
  aside?: ReactNode;
  /** Controls above the figure, e.g. a range switch. */
  toolbar?: ReactNode;
  children?: ReactNode;
}) => (
  <div
    className="relative overflow-hidden rounded-[var(--radius-card)] p-6 flex flex-col gap-4"
    style={{
      background:
        'radial-gradient(120% 130% at 0% 0%, color-mix(in srgb, var(--accent) 10%, var(--surface-raised)) 0%, var(--surface-raised) 62%)',
      border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--line))',
      boxShadow:
        '0 1px 0 color-mix(in srgb, var(--accent) 28%, transparent) inset, 0 18px 40px -24px rgba(0, 0, 0, 0.95)',
    }}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-25 blur-2xl"
      style={{ background: 'var(--accent)' }}
    />
    {toolbar && (
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        {toolbar}
      </div>
    )}
    <div className="relative flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {label}
        </span>
        <button
          type="button"
          onClick={togglePrivacy}
          title="Tap to hide or show amounts"
          className="tap -mx-1 inline-flex w-fit items-baseline rounded-lg px-1 text-left"
        >
          <Amount value={value} size="xl" />
        </button>
        {sub && <span className="text-xs text-[var(--text-muted)]">{sub}</span>}
      </div>
      {aside}
    </div>
    {children && <div className="relative">{children}</div>}
  </div>
);
