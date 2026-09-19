import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { useProcessRecurring } from '@/features/transactions/api/useRecurring';
import { CommandPalette } from '@/features/command/CommandPalette';
import { QuickAdd } from './QuickAdd';
import { Toaster } from '@/ui/Toaster';
import { DataFreshness } from '@/ui/DataFreshness';
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
      { to: '/integrations', label: 'Integrations', icon: 'integrations' },
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

const secondaryLinks: NavEntry[] = [
  { to: '/search', label: 'Search', icon: 'search' },
  { to: '/crypto', label: 'Crypto', icon: 'crypto' },
  { to: '/dividends', label: 'Dividends', icon: 'dividends' },
  { to: '/expenses', label: 'Expenses', icon: 'expenses' },
  { to: '/integrations', label: 'Integrations', icon: 'integrations' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const navItemClass = (isActive: boolean): string =>
  `tap flex items-center gap-3 rounded-[var(--radius-field)] px-2.5 py-2.5 text-sm font-medium ${
    isActive
      ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_2px_0_0_var(--accent)]'
      : 'text-[var(--text-2)] hover:bg-[var(--surface-flat)] hover:text-[var(--text-strong)]'
  }`;

const ThemeButton = () => {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="tap grid h-9 w-9 place-items-center rounded-[var(--radius-field)] neu-flat text-[var(--text-2)]"
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );
};

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
        <ThemeButton />
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

const MoreSheet = ({ onClose }: { onClose: () => void }) => {
  const { signOut } = useAuth();
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface-raised)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line)]" />
        <div className="grid grid-cols-3 gap-3">
          {secondaryLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `tap flex flex-col items-center gap-2 rounded-[var(--radius-card)] px-2 py-4 text-xs font-semibold ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'neu-flat text-[var(--text-2)]'
                }`
              }
            >
              <span className="h-6 w-6 [&>svg]:h-full [&>svg]:w-full">
                {icons[item.icon]}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4">
          <ThemeButton />
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

const BottomBar = ({ onMore }: { onMore: () => void }) => (
  // Must stay position:fixed. A fixed element's containing block is the
  // viewport, which with viewport-fit=cover reaches the physical bottom of the
  // screen — so bottom-0 plus the safe-area padding is what makes the bar's
  // background cover the home indicator. Laying it out in the flow of the shell
  // instead leaves a permanent strip below it.
  <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-[var(--line)] bg-[var(--surface-raised)]/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    {primaryTabs.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          `tap relative flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
            isActive
              ? 'text-[var(--accent)] before:absolute before:left-1/2 before:top-0 before:h-0.5 before:w-8 before:-translate-x-1/2 before:rounded-full before:bg-[var(--accent)]'
              : 'text-[var(--text-muted)]'
          }`
        }
      >
        <span className="h-6 w-6 [&>svg]:h-full [&>svg]:w-full">
          {icons[item.icon]}
        </span>
        {item.label}
      </NavLink>
    ))}
    <button
      type="button"
      onClick={onMore}
      className="tap flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold text-[var(--text-muted)]"
    >
      <span className="h-6 w-6 [&>svg]:h-full [&>svg]:w-full">
        {icons.more}
      </span>
      More
    </button>
  </nav>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const location = useLocation();
  const recurring = useProcessRecurring();
  const ranRecurring = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

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
    <div className="flex h-[100svh] overflow-hidden">
      {offline && (
        <div className="fixed inset-x-0 top-0 z-[70] border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-xs font-semibold text-[var(--text-2)]">
          Sem ligação. Os dados podem estar desatualizados.
        </div>
      )}
      <Sidebar onCommand={() => setPaletteOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--line)] bg-[var(--bg)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:hidden">
          <StrataMark size={26} />
          <span className="text-sm font-extrabold tracking-[0.14em]">STRATA</span>
        </header>
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-contain overflow-x-clip"
        >
          <div className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12">
            <DataFreshness />
            <div key={location.pathname} className="page-enter">
              {children}
            </div>
          </div>
        </main>
      </div>
      <BottomBar onMore={() => setMoreOpen(true)} />
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {!moreOpen && <QuickAdd />}
      <Toaster />
    </div>
  );
};
