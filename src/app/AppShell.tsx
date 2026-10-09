import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useWatchlist } from '@/features/search/api/useMarket';
import { useT212Connection } from '@/features/integrations/api/useT212';
import { useAuth } from '@/features/auth/AuthProvider';
import { BiometricGate } from '@/features/auth/BiometricGate';
import { lockApp, useBiometricLock } from '@/features/auth/biometricLock';
import { useProcessRecurring } from '@/features/transactions/api/useRecurring';
import { CommandPalette } from '@/features/command/CommandPalette';
import { AmountInline } from '@/ui/Amount';
import { QuickAdd } from './QuickAdd';
import { useGlobalSync } from './useGlobalSync';
import { useViewportHeal } from './useViewportHeal';
import { togglePrivacy, usePrivacy } from '@/ui/privacy';
import { Toaster } from '@/ui/Toaster';
import { icons, StrataMark, type IconName } from './icons';
import { useNetWorthSummary } from '@/features/dashboard/api/useNetWorthSummary';
import { preloadCoreRoutes, preloadRoute } from './router';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: number;
  dot?: boolean;
  matchPrefixes?: string[];
}

interface NavSection {
  group: string;
  items: NavEntry[];
}

const PORTFOLIO_PREFIXES = [
  '/positions',
  '/dividends',
  '/crypto',
  '/collectibles',
  '/search',
];
const SETTINGS_PREFIXES = ['/settings', '/integrations'];

const navItemClass = (isActive: boolean): string =>
  `tap flex items-center gap-3 rounded-[var(--radius-field)] px-2.5 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_2px_0_0_var(--accent)]'
      : 'text-[var(--text-2)] hover:bg-[var(--surface-flat)] hover:text-[var(--text-strong)]'
  }`;

const SidebarNetWorth = () => {
  const {
    netNumber: net,
    dayChangeEur,
    accounts,
    cryptoTotal,
    collectiblesTotal,
    positions,
  } = useNetWorthSummary();

  const hasData =
    accounts.length > 0 || cryptoTotal > 0 || collectiblesTotal > 0;
  if (!hasData) return null;

  const todayPl =
    positions.length === 0 && dayChangeEur === 0 ? null : dayChangeEur;
  const dayUp = (todayPl ?? 0) >= 0;

  return (
    <Link
      to="/"
      className="tap flex flex-col gap-1 rounded-[var(--radius-field)] neu-sunken px-3 py-2.5 transition-colors hover:border-[var(--line)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Net worth
        </span>
        {todayPl !== null && todayPl !== 0 && (
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{
              color: dayUp ? 'var(--positive)' : 'var(--negative)',
            }}
          >
            <AmountInline value={todayPl} signed /> today
          </span>
        )}
      </div>
      <div className="text-base font-extrabold tracking-tight tabular-nums text-[var(--text-strong)]">
        <AmountInline value={net} />
      </div>
    </Link>
  );
};

const Sidebar = ({ onCommand }: { onCommand: () => void }) => {
  const { signOut } = useAuth();
  const summary = useNetWorthSummary();
  const { data: watchlist = [] } = useWatchlist();
  const connection = useT212Connection();

  const holdingsCount = summary.positions.length + summary.cryptoCount;
  const t212Connected =
    connection.data !== null && connection.data !== undefined;

  const sections: NavSection[] = [
    {
      group: 'Wealth',
      items: [
        { to: '/', label: 'Overview', icon: 'overview', end: true },
        {
          to: '/positions',
          label: 'Portfolio',
          icon: 'positions',
          badge: holdingsCount > 0 ? holdingsCount : undefined,
        },
        {
          to: '/accounts',
          label: 'Accounts',
          icon: 'accounts',
          badge: summary.accounts.length > 0 ? summary.accounts.length : undefined,
        },
      ],
    },
    {
      group: 'Cashflow',
      items: [
        { to: '/expenses', label: 'Spending', icon: 'expenses' },
        { to: '/transactions', label: 'Activity', icon: 'transactions' },
      ],
    },
    {
      group: 'Investing',
      items: [
        { to: '/dividends', label: 'Dividends', icon: 'dividends' },
        {
          to: '/crypto',
          label: 'Crypto',
          icon: 'crypto',
          badge: summary.cryptoCount > 0 ? summary.cryptoCount : undefined,
        },
        {
          to: '/collectibles',
          label: 'Collectibles',
          icon: 'collectibles',
          badge: summary.collectiblesCount > 0 ? summary.collectiblesCount : undefined,
        },
        {
          to: '/search',
          label: 'Markets',
          icon: 'search',
          badge: watchlist.length > 0 ? watchlist.length : undefined,
        },
      ],
    },
    {
      group: 'System',
      items: [
        {
          to: '/integrations',
          label: 'Integrations',
          icon: 'sync',
          dot: t212Connected,
        },
        { to: '/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ];

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-[var(--line)] bg-gradient-to-b from-[var(--surface-raised)] to-[var(--bg)] px-4 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:flex">
      <Link to="/" className="tap flex items-center gap-2.5 px-2">
        <StrataMark />
        <div>
          <div className="text-[15px] font-extrabold tracking-[0.14em]">STRATA</div>
          <div className="text-[10.5px] text-[var(--text-muted)]">
            Your wealth, layer by layer
          </div>
        </div>
      </Link>

      <SidebarNetWorth />

      <button
        type="button"
        onClick={onCommand}
        className="tap flex items-center gap-2.5 rounded-[var(--radius-field)] neu-sunken px-2.5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-2)]"
      >
        <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
          {icons.search}
        </span>
        <span className="flex-1 text-left">Search or jump…</span>
        <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold">
          ⌘K
        </kbd>
      </button>

      <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
        {sections.map((section) => (
          <div key={section.group}>
            <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
              {section.group}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onMouseEnter={() => preloadRoute(item.to)}
                onTouchStart={() => preloadRoute(item.to)}
                className={({ isActive }) => navItemClass(isActive)}
              >
                <span className="h-[18px] w-[18px] shrink-0 [&>svg]:h-full [&>svg]:w-full">
                  {icons[item.icon]}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-muted)]">
                    {item.badge}
                  </span>
                )}
                {item.dot && (
                  <span
                    title="Connected"
                    className="h-2 w-2 shrink-0 rounded-full bg-[var(--positive)]"
                  />
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--line)] pt-3">
        <SidebarSyncButton />
        <button
          type="button"
          onClick={signOut}
          className="tap ml-auto text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
};

const SidebarSyncButton = () => {
  const globalSync = useGlobalSync();
  const biometric = useBiometricLock();
  const privacyOn = usePrivacy();
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => globalSync.mutate()}
        disabled={globalSync.isPending}
        title="Sync Trading 212 & market prices"
        className="tap flex items-center gap-1.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-strong)] disabled:opacity-45"
      >
        <span
          className={`h-3.5 w-3.5 text-[var(--accent)] [&>svg]:h-full [&>svg]:w-full ${
            globalSync.isPending ? 'animate-spin' : ''
          }`}
        >
          {icons.sync}
        </span>
        <span>{globalSync.isPending ? 'Syncing…' : 'Sync'}</span>
      </button>
      <button
        type="button"
        onClick={togglePrivacy}
        title={privacyOn ? 'Show amounts' : 'Hide amounts'}
        aria-label={privacyOn ? 'Show amounts' : 'Hide amounts'}
        className={`tap flex h-7 w-7 items-center justify-center rounded-[var(--radius-field)] border transition ${
          privacyOn
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text-2)] hover:text-[var(--text-strong)]'
        }`}
      >
        <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">
          {privacyOn ? icons.eyeOff : icons.eye}
        </span>
      </button>
      {biometric.enabled && (
        <button
          type="button"
          onClick={lockApp}
          title="Lock app"
          aria-label="Lock app"
          className="tap flex h-7 w-7 items-center justify-center rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text-2)] hover:text-[var(--text-strong)]"
        >
          <span className="h-3.5 w-3.5 [&>svg]:h-full [&>svg]:w-full">
            {icons.lock}
          </span>
        </button>
      )}
    </div>
  );
};

const BottomBar = ({
  portfolioTarget,
  hidden = false,
}: {
  portfolioTarget: string;
  hidden?: boolean;
}) => {
  const location = useLocation();

  const tabs: NavEntry[] = [
    { to: '/', label: 'Overview', icon: 'overview', end: true },
    {
      to: portfolioTarget,
      label: 'Portfolio',
      icon: 'positions',
      matchPrefixes: PORTFOLIO_PREFIXES,
    },
    {
      to: '/expenses',
      label: 'Spending',
      icon: 'expenses',
      matchPrefixes: ['/expenses'],
    },
    {
      to: '/transactions',
      label: 'Activity',
      icon: 'transactions',
      matchPrefixes: ['/transactions'],
    },
    {
      to: '/accounts',
      label: 'Accounts',
      icon: 'accounts',
      matchPrefixes: ['/accounts'],
    },
  ];

  return (
    <nav
      id="app-bottom-bar"
      aria-label="Primary mobile navigation"
      style={{
        height: 'var(--bottom-bar-total-h)',
        paddingTop: 'var(--bottom-bar-pad-t)',
        paddingBottom: 'var(--bottom-bar-pad-b)',
      }}
      className={`fixed inset-x-0 bottom-0 z-30 flex items-start justify-around border-t border-[var(--line)] bg-[var(--surface-raised)]/95 px-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-opacity duration-150 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-32 after:bg-[var(--surface-raised)] lg:hidden ${
        hidden ? 'invisible opacity-0 pointer-events-none' : 'visible opacity-100'
      }`}
    >
      {tabs.map((item) => {
        const isMatchedByPrefix = item.matchPrefixes?.some((prefix) =>
          location.pathname.startsWith(prefix),
        );
        return (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            onMouseEnter={() => preloadRoute(item.to)}
            onTouchStart={() => preloadRoute(item.to)}
            style={{
              height: 'var(--bottom-bar-item-h)',
              fontSize: 'var(--bottom-bar-font)',
            }}
            className={({ isActive }) => {
              const active = isActive || Boolean(isMatchedByPrefix);
              return `tap relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl font-semibold transition-colors ${
                active
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'
              }`;
            }}
          >
            {({ isActive }) => {
              const active = isActive || Boolean(isMatchedByPrefix);
              return (
                <>
                  {active && (
                    <span className="absolute top-0 h-[2.5px] w-8 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                  )}
                  <span
                    style={{
                      width: 'var(--bottom-bar-icon)',
                      height: 'var(--bottom-bar-icon)',
                    }}
                    className="[&>svg]:h-full [&>svg]:w-full"
                  >
                    {icons[item.icon]}
                  </span>
                  <span className="leading-none tracking-tight">{item.label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}
    </nav>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const location = useLocation();
  const lastPortfolioPath = useRef('/positions');
  const recurring = useProcessRecurring();
  const ranRecurring = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const globalSync = useGlobalSync();
  const biometric = useBiometricLock();
  const privacyOn = usePrivacy();
  const connection = useT212Connection();
  const { keyboardOpen, healViewport, scheduleHeal } = useViewportHeal(
    shellRef,
    mainRef,
  );

  const inPortfolioHub = PORTFOLIO_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );
  const inSettingsHub = SETTINGS_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );
  const t212Connected =
    connection.data !== null && connection.data !== undefined;

  useEffect(() => {
    if (inPortfolioHub) {
      lastPortfolioPath.current = location.pathname;
    }
  }, [inPortfolioHub, location.pathname]);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    healViewport();
  }, [location.pathname, healViewport]);

  const prevOverlay = useRef(false);
  useEffect(() => {
    if (prevOverlay.current && !paletteOpen) {
      scheduleHeal();
    }
    prevOverlay.current = paletteOpen;
  }, [paletteOpen, scheduleHeal]);

  useEffect(() => {
    preloadCoreRoutes();
    if (ranRecurring.current) return;
    ranRecurring.current = true;
    recurring.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // When already inside the Portfolio hub, tapping Portfolio returns to /positions;
  // otherwise it restores the last visited Portfolio sub-tab.
  const portfolioTarget = inPortfolioHub
    ? '/positions'
    : lastPortfolioPath.current;

  return (
    <div
      id="app-shell"
      ref={shellRef}
      className="flex h-full min-h-[100lvh] overflow-hidden bg-[var(--bg)]"
    >
      {offline && (
        <div className="fixed inset-x-0 top-0 z-[70] border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-xs font-semibold text-[var(--text-2)]">
          Offline. Data may be out of date.
        </div>
      )}
      <Sidebar onCommand={() => setPaletteOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:hidden">
          <Link to="/" className="tap flex items-center gap-2">
            <StrataMark size={26} />
            <span className="text-sm font-extrabold tracking-[0.14em]">
              STRATA
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Quick search and commands"
              title="Quick search (⌘K)"
              className="tap flex h-8 w-8 items-center justify-center rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text-2)] hover:text-[var(--text-strong)]"
            >
              <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
                {icons.search}
              </span>
            </button>
            <button
              type="button"
              onClick={togglePrivacy}
              aria-label={privacyOn ? 'Show amounts' : 'Hide amounts'}
              title={privacyOn ? 'Show amounts' : 'Hide amounts'}
              className={`tap flex h-8 w-8 items-center justify-center rounded-[var(--radius-field)] border transition ${
                privacyOn
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text-2)] hover:text-[var(--text-strong)]'
              }`}
            >
              <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
                {privacyOn ? icons.eyeOff : icons.eye}
              </span>
            </button>
            {biometric.enabled && (
              <button
                type="button"
                onClick={lockApp}
                aria-label="Lock app"
                title="Lock app"
                className="tap flex h-8 w-8 items-center justify-center rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text-2)] hover:text-[var(--text-strong)]"
              >
                <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
                  {icons.lock}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => globalSync.mutate()}
              disabled={globalSync.isPending || offline}
              aria-label="Sync portfolio and prices"
              title="Sync portfolio and prices"
              className="tap flex h-8 items-center gap-1.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-strong)] disabled:opacity-45"
            >
              <span
                className={`h-3.5 w-3.5 text-[var(--accent)] [&>svg]:h-full [&>svg]:w-full ${
                  globalSync.isPending ? 'animate-spin' : ''
                }`}
              >
                {icons.sync}
              </span>
              <span className="hidden xs:inline">
                {globalSync.isPending ? 'Syncing…' : 'Sync'}
              </span>
            </button>
            <NavLink
              to="/settings"
              aria-label="Settings and integrations"
              title="Settings & Integrations"
              className={`tap relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-field)] border transition ${
                inSettingsHub
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--text-2)] hover:text-[var(--text-strong)]'
              }`}
            >
              <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
                {icons.settings}
              </span>
              {t212Connected && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--positive)] ring-2 ring-[var(--bg)]"
                />
              )}
            </NavLink>
          </div>
        </header>
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-contain overflow-x-clip"
        >
          <div className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pb-12">
            <div key={location.pathname} className="page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
      <BottomBar portfolioTarget={portfolioTarget} hidden={keyboardOpen} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <QuickAdd hidden={keyboardOpen} />
      <BiometricGate />
      <Toaster />
    </div>
  );
};
