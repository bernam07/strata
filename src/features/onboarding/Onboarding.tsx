import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePersistentState } from '@/app/usePersistentState';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import {
  useNetWorthGoal,
  useSetNetWorthGoal,
} from '@/features/dashboard/api/usePreferences';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { MoneyInput } from '@/ui/Field';

interface Step {
  label: string;
  hint: string;
  to?: string;
  kind?: 'goal';
  done: boolean;
}

const rowClass =
  'tap flex w-full items-center gap-3 rounded-[var(--radius-field)] neu-flat p-3 text-left hover:border-[var(--accent)]';

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

const StepBody = ({ step }: { step: Step }) => (
  <>
    <Check done={step.done} />
    <div className="min-w-0 flex-1">
      <p
        className="text-sm font-semibold"
        style={{
          color: step.done ? 'var(--text-muted)' : 'var(--text-strong)',
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
  </>
);

export const Onboarding = () => {
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: goal } = useNetWorthGoal();
  const setGoal = useSetNetWorthGoal();
  const [dismissed, setDismissed] = usePersistentState('onboarding-done', false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [draft, setDraft] = useState('');

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
      kind: 'goal',
      done: goal !== null && goal !== undefined,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const firstRun = accounts.length === 0;

  // Always guide a brand-new user; otherwise show until finished or dismissed.
  if (allDone || (dismissed && !firstRun)) return null;

  const saveGoal = () => {
    const value = Number(draft);
    if (!Number.isFinite(value) || value <= 0) return;
    setGoal.mutate(value, {
      onSuccess: () => {
        setEditingGoal(false);
        setDraft('');
      },
    });
  };

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
        {steps.map((step) => {
          if (step.kind === 'goal') {
            return (
              <li key={step.label} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    !step.done && setEditingGoal((editing) => !editing)
                  }
                  className={rowClass}
                >
                  <StepBody step={step} />
                </button>
                {editingGoal && !step.done && (
                  <div className="flex items-end gap-2 pl-9">
                    <div className="flex-1">
                      <MoneyInput
                        placeholder="Target €"
                        value={draft}
                        onChange={setDraft}
                      />
                    </div>
                    <Button
                      onClick={saveGoal}
                      disabled={setGoal.isPending || !draft}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </li>
            );
          }
          return (
            <li key={step.label}>
              <Link to={step.to ?? '/'} className={rowClass}>
                <StepBody step={step} />
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};
