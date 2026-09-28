import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { BiometricGate } from '@/features/auth/BiometricGate';
import { lockApp, useBiometricLock } from '@/features/auth/biometricLock';
import { useProcessRecurring } from '@/features/transactions/api/useRecurring';
import { AdvisorPanel, CommandPalette } from '@/features/command/CommandPalette';
import { QuickAdd } from './QuickAdd';
import { useGlobalSync } from './useGlobalSync';
import { useViewportHeal } from './useViewportHeal';
import { Toaster } from '@/ui/Toaster';
import { icons, StrataMark, type IconName } from './icons';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

interface NavSection {
  group: string;
  items: NavEntry[];
}

const sections: NavSection[] = [
  {
    group: 'Ledger',
    items: [
      { to: '/', label: 'Overview', icon: 'overview', end: true },
      { to: '/accounts', label: 'Accounts', icon: 'accounts' },
      { to: '/transactions', label: 'Transactions', icon: 'transactions' },
    ],
  },
  {
    group: 'Invest',
    items: [
      { to: '/positions', label: 'Portfolio', icon: 'positions' },
      { to: '/search', label: 'Search', icon: 'search' },
      { to: '/crypto', label: 'Crypto', icon: 'crypto' },
      { to: '/dividends', label: 'Dividends', icon: 'dividends' },
    ],
  },
  {
    group: 'Spend',
    items: [
      { to: '/expenses', label: 'Expenses', icon: 'expenses' },
      { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const primaryTabs: NavEntry[] = [
  { to: '/', label: 'Overview', icon: 'overview', end: true },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
  { to: '/transactions', label: 'Activity', icon: 'transactions' },
  { to: '/positions', label: 'Portfolio', icon: 'positions' },
];

const secondarySections: NavSection[] = [
  {
    group: 'Explore',
    items: [
      { to: '/search', label: 'Search', icon: 'search' },
      { to: '/crypto', label: 'Crypto', icon: 'crypto' },
      { to: '/dividends', label: 'Dividends', icon: 'dividends' },
    ],
  },
  {
    group: 'Manage',
    items: [
      { to: '/expenses', label: 'Expenses', icon: 'expenses' },
      { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const navItemClass = (isActive: boolean): string =>
  `tap flex items-center gap-3 rounded-[var(--radius-field)] px-2.5 py-2.5 text-sm font-medium ${
    isActive
      ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_2px_0_0_var(--accent)]'
      : 'text-[var(--text-2)] hover:bg-[var(--surface-flat)] hover:text-[var(--text-strong)]'
  }`;

const Sidebar = ({ onCommand }: { onCommand: () => void }) => {
  const { signOut } = useAuth();
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-[var(--line)] bg-gradient-to-b from-[var(--surface-raised)] to-[var(--bg)] px-4 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <StrataMark />
        <div>
          <div className="text-[15px] font-extrabold tracking-[0.14em]">STRATA</div>
          <div className="text-[10.5px] text-[var(--text-muted)]">
            Your wealth, layer by layer
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onCommand}
        className="tap mt-1 flex items-center gap-2.5 rounded-[var(--radius-field)] neu-sunken px-2.5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-2)]"
      >
        <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
          {icons.search}
        </span>
        <span className="flex-1 text-left">Search or jump…</span>
        <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold">
          ⌘K
        </kbd>
      </button>

      <nav className="flex flex-col gap-0.5">
        {sections.map((section) => (
          <div key={section.group}>
            <p className="px-2.5 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
              {section.group}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => navItemClass(isActive)}
              >
                <span className="h-[18px] w-[18px] [&>svg]:h-full [&>svg]:w-full">
                  {icons[item.icon]}
                </span>
                {item.label}
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

const MoreSheet = ({
  onClose,
  onAdvisor,
}: {
  onClose: () => void;
  onAdvisor: () => void;
}) => {
  const { signOut } = useAuth();
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface-raised)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line)]" />
        <div className="flex flex-col gap-4">
          {secondarySections.map((section) => (
            <div key={section.group}>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
                {section.group}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `tap flex items-center gap-2 rounded-[var(--radius-field)] px-2.5 py-3 text-xs font-semibold ${
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'neu-flat text-[var(--text-2)]'
                      }`
                    }
                  >
                    <span className="h-4 w-4 shrink-0 [&>svg]:h-full [&>svg]:w-full">
                      {icons[item.icon]}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
                {section.group === 'Manage' && (
                  <button
                    type="button"
                    onClick={onAdvisor}
                    className="tap flex items-center gap-2 rounded-[var(--radius-field)] neu-flat px-2.5 py-3 text-xs font-semibold text-[var(--text-2)]"
                  >
                    <span className="h-4 w-4 shrink-0 text-[var(--accent)] [&>svg]:h-full [&>svg]:w-full">
                      {icons.advisor}
                    </span>
                    <span className="truncate">Advisor</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end border-t border-[var(--line)] pt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              void signOut();
            }}
            className="tap text-sm font-semibold text-[var(--text-muted)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const BottomBar = ({
  onMore,
  hidden = false,
}: {
  onMore: () => void;
  hidden?: boolean;
}) => {
  return (
    <nav
      id="app-bottom-bar"
      className={`fixed inset-x-0 bottom-0 z-30 h-[calc(4.25rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-[var(--line)] bg-[var(--surface-raised)]/95 px-1 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md lg:hidden ${
        hidden ? 'hidden pointer-events-none' : 'flex'
      }`}
    >
      {primaryTabs.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `tap relative flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${
              isActive
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-2)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute top-0 h-[2.5px] w-8 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
              )}
              <span className="h-6 w-6 [&>svg]:h-full [&>svg]:w-full">
                {icons[item.icon]}
              </span>
              <span className="leading-tight">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMore}
        className="tap relative flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-2)] transition-colors"
      >
        <span className="h-6 w-6 [&>svg]:h-full [&>svg]:w-full">
          {icons.more}
        </span>
        <span className="leading-tight">More</span>
      </button>
    </nav>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const location = useLocation();
  const recurring = useProcessRecurring();
  const ranRecurring = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const globalSync = useGlobalSync();
  const biometric = useBiometricLock();
  const { keyboardOpen, healViewport, scheduleHeal } = useViewportHeal(
    shellRef,
    mainRef,
  );

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    const t = setTimeout(healViewport, 80);
    return () => clearTimeout(t);
  }, [location.pathname, healViewport]);

  const prevOverlay = useRef(false);
  useEffect(() => {
    const anyOpen = moreOpen || paletteOpen || advisorOpen;
    if (prevOverlay.current && !anyOpen) {
      scheduleHeal();
    }
    prevOverlay.current = anyOpen;
  }, [moreOpen, paletteOpen, advisorOpen, scheduleHeal]);

  useEffect(() => {
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

  return (
    <div id="app-shell" ref={shellRef} className="flex h-[100dvh] min-h-[100dvh] overflow-hidden">
      {offline && (
        <div className="fixed inset-x-0 top-0 z-[70] border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-xs font-semibold text-[var(--text-2)]">
          Offline. Data may be out of date.
        </div>
      )}
      <Sidebar onCommand={() => setPaletteOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--line)] bg-[var(--bg)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:hidden">
          <StrataMark size={26} />
          <span className="text-sm font-extrabold tracking-[0.14em]">STRATA</span>
          <div className="ml-auto flex items-center gap-2">
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
              <span>{globalSync.isPending ? 'Syncing…' : 'Sync'}</span>
            </button>
          </div>
        </header>
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-contain overflow-x-clip"
        >
          <div className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-10 lg:pb-12">
            <div key={location.pathname} className="page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
      <BottomBar onMore={() => setMoreOpen(true)} hidden={keyboardOpen} />
      {moreOpen && (
        <MoreSheet
          onClose={() => setMoreOpen(false)}
          onAdvisor={() => {
            setMoreOpen(false);
            setAdvisorOpen(true);
          }}
        />
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AdvisorPanel open={advisorOpen} onClose={() => setAdvisorOpen(false)} />
      {!moreOpen && <QuickAdd hidden={keyboardOpen} />}
      <BiometricGate />
      <Toaster />
    </div>
  );
};
