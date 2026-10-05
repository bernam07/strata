import { NavLink, useLocation } from 'react-router-dom';
import { icons, type IconName } from '@/app/icons';
import { usePositions } from '@/features/positions/api/usePositions';
import { useCrypto } from '@/features/crypto/api/useCrypto';
import { useCollectibles } from '@/features/collectibles/api/useCollectibles';
import { useWatchlist } from '@/features/search/api/useMarket';
import { useT212Connection } from '@/features/integrations/api/useT212';

interface HubTab {
  to: string;
  label: string;
  icon: IconName;
  badge?: string | number;
  dot?: boolean;
  matchPrefixes?: string[];
}

const HubNavBar = ({
  ariaLabel,
  tabs,
}: {
  ariaLabel: string;
  tabs: HubTab[];
}) => {
  const location = useLocation();

  return (
    <nav
      aria-label={ariaLabel}
      className="-mx-1 flex items-center gap-1 overflow-x-auto rounded-(--radius-card) neu-sunken p-1.5 no-scrollbar"
    >
      {tabs.map((tab) => {
        const isMatchedByPrefix = tab.matchPrefixes?.some((prefix) =>
          location.pathname.startsWith(prefix),
        );
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => {
              const active = isActive || Boolean(isMatchedByPrefix);
              return `tap flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-(--radius-field) px-3 py-2 text-xs font-semibold transition-all ${
                active
                  ? 'neu-raised bg-(--surface-raised) text-(--accent) shadow-sm'
                  : 'text-(--text-muted) hover:text-(--text-strong)'
              }`;
            }}
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 [&>svg]:h-full [&>svg]:w-full"
            >
              {icons[tab.icon]}
            </span>
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="rounded-full bg-(--surface-sunken) px-1.5 py-0.2 text-[10px] font-bold tabular-nums text-(--text-muted)">
                {tab.badge}
              </span>
            )}
            {tab.dot && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--positive)"
              />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

export const PortfolioNav = () => {
  const { data: positionsData } = usePositions();
  const { data: crypto = [] } = useCrypto();
  const { data: collectibles = [] } = useCollectibles();
  const { data: watchlist = [] } = useWatchlist();

  const holdingsCount = (positionsData?.positions.length ?? 0) + crypto.length;
  const cryptoCount = crypto.length;
  const collectiblesCount = collectibles.length;
  const watchlistCount = watchlist.length;

  const tabs: HubTab[] = [
    {
      to: '/positions',
      label: 'Holdings',
      icon: 'positions',
      badge: holdingsCount > 0 ? holdingsCount : undefined,
      matchPrefixes: ['/positions'],
    },
    {
      to: '/dividends',
      label: 'Dividends',
      icon: 'dividends',
    },
    {
      to: '/crypto',
      label: 'Crypto',
      icon: 'crypto',
      badge: cryptoCount > 0 ? cryptoCount : undefined,
    },
    {
      to: '/collectibles',
      label: 'Collectibles',
      icon: 'collectibles',
      badge: collectiblesCount > 0 ? collectiblesCount : undefined,
    },
    {
      to: '/search',
      label: 'Markets',
      icon: 'search',
      badge: watchlistCount > 0 ? watchlistCount : undefined,
    },
  ];

  return <HubNavBar ariaLabel="Portfolio sections" tabs={tabs} />;
};

export const CashflowNav = () => {
  const tabs: HubTab[] = [
    {
      to: '/expenses',
      label: 'Spending & Budgets',
      icon: 'expenses',
    },
    {
      to: '/transactions',
      label: 'Activity Ledger',
      icon: 'transactions',
    },
  ];

  return <HubNavBar ariaLabel="Cashflow sections" tabs={tabs} />;
};

export const SettingsNav = () => {
  const connection = useT212Connection();
  const connected = connection.data !== null && connection.data !== undefined;

  const tabs: HubTab[] = [
    {
      to: '/settings',
      label: 'Preferences & Security',
      icon: 'settings',
    },
    {
      to: '/integrations',
      label: 'Integrations & Sync',
      icon: 'sync',
      dot: connected,
    },
  ];

  return <HubNavBar ariaLabel="Settings sections" tabs={tabs} />;
};
