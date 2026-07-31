import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/ui/theme/ThemeProvider';

const links = [
  { to: '/', label: 'Resumo', end: true },
  { to: '/accounts', label: 'Contas', end: false },
  { to: '/transactions', label: 'Transações', end: false },
  { to: '/positions', label: 'Posições', end: false },
  { to: '/dividends', label: 'Dividendos', end: false },
  { to: '/analytics', label: 'Análise', end: false },
  { to: '/integrations', label: 'Integrações', end: false },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight text-[var(--text-strong)]">
          Strata
        </span>
        <nav className="flex items-center gap-2 rounded-[var(--radius-neu-sm)] neu-sunken p-1.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-[var(--radius-neu-sm)] px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? 'neu-flat text-[var(--accent)]'
                    : 'text-[var(--text-muted)]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label="Alternar tema"
            className="flex h-10 w-10 items-center justify-center rounded-full neu-flat text-[var(--text-muted)]"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-full neu-flat text-[var(--text-muted)]"
            aria-label="Terminar sessão"
          >
            ⎋
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
};
