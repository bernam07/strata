import { useState } from 'react';
import { money, toNumber, type Money } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { MoneyInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import { pct0 as percent } from '@/ui/format';
import { useNetWorthGoal, useSetNetWorthGoal } from './api/usePreferences';

export const GoalCard = ({ net }: { net: Money }) => {
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

  if (goal === null && !editing) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Set a net-worth goal
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Track progress toward a target.
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
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--text-strong)]">
          Net-worth goal
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
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
    ? Math.max(0, Math.min(1, toNumber(net) / goal!))
    : 0;
  const reached = toNumber(net) >= goal!;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-[var(--text-strong)]">
          Goal · <AmountInline value={toNumber(target)} />
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft(String(goal));
            setEditing(true);
          }}
          className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
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
      <p className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
        {percent.format(ratio)}
        {!reached && (
          <>
            {' · '}
            <AmountInline value={toNumber(target.minus(net))} /> to go
          </>
        )}
        {reached && ' · reached 🎉'}
      </p>
    </Card>
  );
};
