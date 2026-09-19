import type { ReactNode } from 'react';

const wrap = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export type IconName =
  | 'overview'
  | 'accounts'
  | 'transactions'
  | 'positions'
  | 'dividends'
  | 'expenses'
  | 'integrations'
  | 'search'
  | 'settings'
  | 'crypto'
  | 'more';

export const icons: Record<IconName, ReactNode> = {
  overview: wrap(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>,
  ),
  accounts: wrap(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
    </>,
  ),
  transactions: wrap(<path d="M4 7h16M4 12h16M4 17h10" />),
  positions: wrap(<path d="M4 19V5M4 15l5-4 4 3 7-7" />),
  dividends: wrap(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9 11h6" />
    </>,
  ),
  expenses: wrap(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l4-2M12 12v4" />
    </>,
  ),
  integrations: wrap(<path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />),
  search: wrap(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
  ),
  settings: wrap(
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3" />
      <path d="M15 4v4M9 10v4M15 16v4" />
    </>,
  ),
  crypto: wrap(
    <>
      <circle cx="9" cy="9" r="5.5" />
      <circle cx="15" cy="15" r="5.5" />
      <path d="M15 12.2v5.6" />
    </>,
  ),
  more: wrap(
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>,
  ),
};

export const StrataMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect x="4" y="20" width="24" height="5" rx="2" fill="var(--accent)" />
    <rect x="6" y="13" width="20" height="5" rx="2" fill="var(--accent)" opacity="0.9" />
    <rect x="9" y="6" width="14" height="5" rx="2" fill="var(--accent)" opacity="0.75" />
  </svg>
);
