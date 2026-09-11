import type { ReactNode } from 'react';
import { Amount } from './Amount';
import { Card } from './Card';

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
  <Card className="flex flex-col gap-4">
    {toolbar && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {toolbar}
      </div>
    )}
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {label}
        </span>
        <Amount value={value} size="xl" />
        {sub && <span className="text-xs text-[var(--text-muted)]">{sub}</span>}
      </div>
      {aside}
    </div>
    {children}
  </Card>
);
