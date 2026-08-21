import { useState, type ReactNode } from 'react';
import { Card } from './Card';

// A card whose body collapses behind a clickable header, with an optional
// inline badge that stays visible while closed. Used across the app so every
// collapsible section looks and behaves the same.
export const Collapsible = ({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="tap flex items-center justify-between gap-3"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {title}
          </span>
          {badge != null && (
            <span className="text-sm font-semibold tabular-nums text-[var(--text-2)]">
              {badge}
            </span>
          )}
        </span>
        <span
          className="text-[var(--text-muted)] transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >
          ›
        </span>
      </button>
      {open && (
        <div className="page-enter flex flex-col gap-4">{children}</div>
      )}
    </Card>
  );
};
