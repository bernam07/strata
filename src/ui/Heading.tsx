import type { ReactNode } from 'react';

// The app has one heading treatment for a group of content: small, bold,
// uppercase, widely tracked, in the muted tone. It matches the header the
// Collapsible card draws and the one SectionTitle uses outside a card, so a
// plain card, a collapsible and a page section all read as the same rank.
export const headingClass =
  'text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]';

export const CardTitle = ({ children }: { children: ReactNode }) => (
  <h2 className={headingClass}>{children}</h2>
);

// The label directly above a figure — a touch smaller and wider than a
// heading, used by PageHero and the stat tiles.
export const eyebrowClass =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]';
