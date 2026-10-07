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
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4">
    <div className="min-w-0 flex-1">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)] sm:truncate">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
        {actions}
      </div>
    )}
  </div>
);
