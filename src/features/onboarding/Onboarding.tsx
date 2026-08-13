import { Link } from 'react-router-dom';
import { usePersistentState } from '@/app/usePersistentState';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { useNetWorthGoal } from '@/features/dashboard/api/usePreferences';
import { Card } from '@/ui/Card';

interface Step {
  label: string;
  hint: string;
  to: string;
  done: boolean;
}

const Check = ({ done }: { done: boolean }) => (
  <span
    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
    style={{
      background: done ? 'var(--accent)' : 'var(--surface-flat)',
      color: done ? '#0a0a0b' : 'var(--text-muted)',
      boxShadow: done ? 'none' : 'inset 0 0 0 1px var(--line)',
    }}
  >
    {done ? '✓' : ''}
  </span>
);

export const Onboarding = () => {
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: goal } = useNetWorthGoal();
  const [dismissed, setDismissed] = usePersistentState('onboarding-done', false);

  const steps: Step[] = [
    {
      label: 'Add your first account',
      hint: 'A bank, a broker, cash — anything you want to track.',
      to: '/accounts',
      done: accounts.length > 0,
    },
    {
      label: 'Connect Trading 212 or record a movement',
      hint: 'Import your holdings automatically, or add a transaction by hand.',
      to: accounts.length > 0 ? '/integrations' : '/accounts',
      done: transactions.length > 0,
    },
    {
      label: 'Set a net-worth goal',
      hint: 'Track your progress toward a target on the dashboard below.',
      to: '/',
      done: goal !== null && goal !== undefined,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const firstRun = accounts.length === 0;

  // Always guide a brand-new user; otherwise show until finished or dismissed.
  if (allDone || (dismissed && !firstRun)) return null;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-strong)]">
            {firstRun ? 'Welcome to Strata' : 'Finish setting up'}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {firstRun
              ? 'Three quick steps to see your whole net worth in one place.'
              : `${doneCount} of ${steps.length} done.`}
          </p>
        </div>
        {!firstRun && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full neu-sunken">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${(doneCount / steps.length) * 100}%`,
            background: 'var(--accent)',
          }}
        />
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className="tap flex items-center gap-3 rounded-[var(--radius-field)] neu-flat p-3 hover:border-[var(--accent)]"
            >
              <Check done={step.done} />
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: step.done
                      ? 'var(--text-muted)'
                      : 'var(--text-strong)',
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}
                >
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-[var(--text-muted)]">{step.hint}</p>
                )}
              </div>
              {!step.done && <span className="text-[var(--text-muted)]">›</span>}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
};
