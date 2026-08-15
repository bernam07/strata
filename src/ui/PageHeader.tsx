import type { ReactNode } from 'react';

// One header treatment for every page: a title, an optional subtitle, and an
// optional actions cluster that wraps below the title on narrow screens.
export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);
