import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { useAskAdvisor } from '@/features/advisor/api/useAdvisor';
import { icons, type IconName } from '@/app/icons';
import { toast } from '@/ui/toast';
import { isPrivacyOn, togglePrivacy, usePrivacy } from '@/ui/privacy';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { filterCommands } from './commands';

interface Command {
  id: string;
  label: string;
  group: 'Go to' | 'Actions';
  keywords?: string[];
  icon?: IconName;
  glyph?: string;
  run: () => void;
}

const suggestedQuestions = [
  'What changed in my net worth recently?',
  'What are my largest holdings?',
  'Summarize my recent activity.',
];

export const AdvisorPanel = ({
  open,
  onClose,
  initialQuestion = '',
}: {
  open: boolean;
  onClose: () => void;
  initialQuestion?: string;
}) => {
  const advisor = useAskAdvisor();
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (open) {
      setQuestion(initialQuestion);
    } else {
      setQuestion('');
      advisor.reset();
    }
  }, [open, initialQuestion]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed) advisor.mutate(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center px-3 pb-3 sm:items-start sm:px-4 sm:pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Ask Strata Advisor"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-lg p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--accent)]">
              Strata Advisor
            </p>
            <h2 className="mt-1 text-lg font-bold text-[var(--text-strong)]">
              Ask about your finances
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close advisor"
            className="tap grid h-9 w-9 place-items-center rounded-[var(--radius-field)] neu-flat text-lg text-[var(--text-muted)]"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Labelled label="Question">
            <TextInput
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What would you like to understand?"
              maxLength={2000}
              autoFocus
            />
          </Labelled>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuestion(suggestion)}
                className="tap rounded-[var(--radius-pill)] border border-[var(--line)] px-2.5 py-1.5 text-left text-xs text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={!question.trim() || advisor.isPending}>
            {advisor.isPending ? 'Thinking…' : 'Ask Strata Advisor'}
          </Button>
        </form>

        {advisor.isError && (
          <p className="mt-4 text-sm text-[var(--negative)]" role="alert">
            {advisor.error instanceof Error
              ? advisor.error.message
              : 'Unable to answer that question right now.'}
          </p>
        )}
        {advisor.data && (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
              Answer
            </p>
            <p className="max-h-[32vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[var(--text-2)]">
              {advisor.data.answer}
            </p>
            {advisor.data.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Sources
                </span>
                {advisor.data.sources.map((source) => (
                  <a
                    key={source.path}
                    href={source.path}
                    onClick={onClose}
                    className="tap rounded-[var(--radius-pill)] border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)]"
                  >
                    {source.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-[11px] leading-5 text-[var(--text-muted)]">
          Read-only context from your Strata data. Answers may be incomplete and are not financial advice.
        </p>
      </Card>
    </div>
  );
};

export const CommandPalette = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const refresh = useRefreshPrices();
  const privacy = usePrivacy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [advisorOpen, setAdvisorOpen] = useState(false);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string, label: string, icon: IconName, keywords?: string[]): Command => ({
      id: `go:${to}`,
      label,
      group: 'Go to',
      icon,
      keywords,
      run: () => navigate(to),
    });
    return [
      go('/', 'Overview', 'overview', ['dashboard', 'home', 'net worth']),
      go('/accounts', 'Accounts', 'accounts', ['banks', 'cash']),
      go('/transactions', 'Transactions', 'transactions', ['activity', 'ledger']),
      go('/positions', 'Portfolio', 'positions', ['holdings', 'stocks', 'analytics']),
      go('/search', 'Search', 'search', ['stocks', 'quote', 'watchlist']),
      go('/crypto', 'Crypto', 'crypto', ['bitcoin', 'coins', 'ethereum']),
      go('/dividends', 'Dividends', 'dividends', ['income', 'forecast']),
      go('/expenses', 'Expenses', 'expenses', ['spending', 'budget']),
      go('/integrations', 'Integrations', 'integrations', ['trading 212', 't212', 'widget']),
      go('/settings', 'Settings', 'settings', ['theme', 'backup', 'notifications']),
      {
        id: 'action:advisor',
        label: 'Ask Strata Advisor',
        group: 'Actions',
        glyph: '?',
        keywords: ['gemini', 'finance', 'question', 'help'],
        run: () => setAdvisorOpen(true),
      },
      {
        id: 'action:refresh',
        label: 'Refresh prices',
        group: 'Actions',
        glyph: '↻',
        keywords: ['sync', 'update', 'market'],
        run: () => {
          toast('Refreshing prices…');
          refresh.mutate(undefined, {
            onSuccess: (result) =>
              toast(
                `Updated ${result?.updated ?? 0} holding${result?.updated === 1 ? '' : 's'}`,
                'success',
              ),
            onError: () => toast("Couldn't refresh prices", 'error'),
          });
        },
      },
      {
        id: 'action:privacy',
        label: privacy ? 'Show amounts' : 'Hide amounts',
        group: 'Actions',
        glyph: privacy ? '𐄂' : '⦿',
        keywords: ['privacy', 'blur', 'balances', 'hide'],
        run: () => {
          togglePrivacy();
          toast(isPrivacyOn() ? 'Amounts hidden' : 'Amounts visible');
        },
      },
      {
        id: 'action:signout',
        label: 'Sign out',
        group: 'Actions',
        glyph: '⏻',
        keywords: ['log out', 'logout'],
        run: () => void signOut(),
      },
    ];
  }, [navigate, refresh, signOut, privacy]);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const run = (command: Command) => {
    command.run();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[active];
      if (command) run(command);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup: Command['group'] | null = null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] neu-raised"
            onKeyDown={onKeyDown}
          >
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <span className="text-[var(--text-muted)]">
            <span className="block h-4 w-4 [&>svg]:h-full [&>svg]:w-full">
              {icons.search}
            </span>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and actions…"
            className="w-full bg-transparent py-3.5 text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <kbd className="hidden rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] sm:block">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              No matches.
            </li>
          )}
          {results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            const isActive = index === active;
            return (
              <li key={command.id}>
                {header && (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
                    {header}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => run(command)}
                  onPointerMove={() => setActive(index)}
                  className={`tap flex w-full items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5 text-left text-sm ${
                    isActive
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-2)]'
                  }`}
                >
                  <span className="grid h-5 w-5 place-items-center [&>svg]:h-full [&>svg]:w-full">
                    {command.icon ? icons[command.icon] : (command.glyph ?? '›')}
                  </span>
                  <span className="flex-1 font-medium">{command.label}</span>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                      ↵
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
          </div>
        </div>
      )}
      <AdvisorPanel open={advisorOpen} onClose={() => setAdvisorOpen(false)} />
    </>
  );
};
