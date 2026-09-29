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
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
      </div>
    )}
  </div>
);
