import { Link } from 'react-router-dom';

// One heading treatment for the groups on a page, matching the header the
// Collapsible card renders so a plain section and a collapsible one read the
// same. Optionally carries a trailing link or a plain note on the right.
export const SectionTitle = ({
  children,
  action,
  note,
}: {
  children: string;
  action?: { to: string; label: string };
  note?: string;
}) => (
  <div className="flex items-baseline justify-between gap-3 px-0.5">
    <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
      {children}
    </h2>
    {action && (
      <Link to={action.to} className="tap text-xs font-semibold text-[var(--accent)]">
        {action.label} →
      </Link>
    )}
    {!action && note && (
      <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
        {note}
      </span>
    )}
  </div>
);
