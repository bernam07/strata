import { useState } from 'react';
import { money, toNumber, type Money } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { MoneyInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import { pct0 as percent } from '@/ui/format';
import { useNetWorthGoal, useSetNetWorthGoal } from './api/usePreferences';

const projectFutureWealth = (
  principal: number,
  monthlyContribution: number,
  years: number,
  annualReturn = 0.08,
): number => {
  const months = years * 12;
  const r = annualReturn / 12;
  const compoundedPrincipal = principal * Math.pow(1 + r, months);
  const compoundedContributions =
    monthlyContribution > 0
      ? monthlyContribution * ((Math.pow(1 + r, months) - 1) / r)
      : 0;
  return Math.max(0, compoundedPrincipal + compoundedContributions);
};

const estimateMonthsToGoal = (
  current: number,
  goal: number,
  monthlyContribution: number,
  annualReturn = 0.08,
): number | null => {
  if (current >= goal) return 0;
  const r = annualReturn / 12;
  const contrib = Math.max(0, monthlyContribution);
  if (current <= 0 && contrib <= 0) return null;
  let balance = Math.max(0, current);
  for (let m = 1; m <= 600; m += 1) {
    balance = balance * (1 + r) + contrib;
    if (balance >= goal) return m;
  }
  return null;
};

export const GoalCard = ({
  net,
  monthlySavings = 0,
}: {
  net: Money;
  monthlySavings?: number;
}) => {
  const { data: goal, isLoading } = useNetWorthGoal();
  const setGoal = useSetNetWorthGoal();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (isLoading) return null;

  const save = () => {
    const value = Number(draft);
    if (!Number.isFinite(value) || value <= 0) return;
    setGoal.mutate(value, {
      onSuccess: () => {
        setEditing(false);
        toast('Goal saved', 'success');
      },
      onError: () => toast("Couldn't save goal", 'error'),
    });
  };

  const netNum = toNumber(net);
  const pace = Math.max(0, monthlySavings);
  const proj1Y = projectFutureWealth(netNum, pace, 1);
  const proj5Y = projectFutureWealth(netNum, pace, 5);
  const proj10Y = projectFutureWealth(netNum, pace, 10);

  if (goal === null && !editing) {
    return (
      <Card className="flex min-w-0 flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-strong)]">
              Set a net-worth goal
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Track milestones and your 10-year compounding trajectory.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft('');
              setEditing(true);
            }}
          >
            Set goal
          </Button>
        </div>
        {netNum > 0 && (
          <div className="grid grid-cols-3 gap-2 border-t border-[var(--line)]/60 pt-3">
            {[
              { label: '1Y (8% p.a.)', val: proj1Y },
              { label: '5Y (8% p.a.)', val: proj5Y },
              { label: '10Y (8% p.a.)', val: proj10Y },
            ].map((item) => (
              <div
                key={item.label}
                className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-2.5 py-2"
              >
                <span className="truncate text-[10px] font-semibold text-[var(--text-muted)]">
                  {item.label}
                </span>
                <span className="truncate text-xs font-bold text-[var(--text-strong)]">
                  <AmountInline value={item.val} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="flex min-w-0 flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--text-strong)]">
          Net-worth goal
        </p>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <MoneyInput
              placeholder="Target €"
              value={draft}
              onChange={setDraft}
            />
          </div>
          <Button onClick={save} disabled={setGoal.isPending || !draft}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  const target = money(goal!);
  const ratio = target.greaterThan(0)
    ? Math.max(0, Math.min(1, netNum / goal!))
    : 0;
  const reached = netNum >= goal!;
  const monthsToGoal = !reached ? estimateMonthsToGoal(netNum, goal!, pace) : 0;

  const etaText =
    monthsToGoal !== null && monthsToGoal > 0
      ? monthsToGoal < 12
        ? `~${monthsToGoal} mo${monthsToGoal === 1 ? '' : 's'} ETA`
        : `~${(monthsToGoal / 12).toFixed(1)} yrs ETA`
      : null;

  return (
    <Card className="flex min-w-0 flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
          Goal · <AmountInline value={toNumber(target)} />
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft(String(goal));
            setEditing(true);
          }}
          className="tap shrink-0 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        >
          Edit
        </button>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full neu-sunken">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${ratio * 100}%`,
            background: reached ? 'var(--positive)' : 'var(--accent)',
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
        <span>
          {percent.format(ratio)}
          {!reached && (
            <>
              {' · '}
              <AmountInline value={toNumber(target.minus(net))} /> to go
            </>
          )}
          {reached && ' · reached 🎉'}
        </span>
        {etaText && (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
            {etaText}
          </span>
        )}
      </div>

      {netNum > 0 && (
        <div className="grid grid-cols-3 gap-2 border-t border-[var(--line)]/60 pt-3">
          {[
            { label: 'In 1 year', val: proj1Y },
            { label: 'In 5 years', val: proj5Y },
            { label: 'In 10 years', val: proj10Y },
          ].map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-2.5 py-2"
            >
              <span className="truncate text-[10px] font-semibold text-[var(--text-muted)]">
                {item.label}
              </span>
              <span className="truncate text-xs font-bold text-[var(--text-strong)]">
                <AmountInline value={item.val} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

