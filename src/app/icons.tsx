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
  | 'more'
  | 'advisor'
  | 'sync'
  | 'lock'
  | 'eye'
  | 'eyeOff';

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
  advisor: wrap(
    <>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
    </>
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
  sync: wrap(
    <>
      <path d="M21 12a9 9 0 0 0-15.4-6.4L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 15.4 6.4L21 16" />
      <path d="M21 21v-5h-5" />
    </>,
  ),
  lock: wrap(
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>,
  ),
  eye: wrap(
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  eyeOff: wrap(
    <>
      <path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9" />
      <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c6.4 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2" />
      <path d="M2 2l20 20" />
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
