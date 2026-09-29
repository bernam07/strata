import { useState, type FormEvent } from 'react';
import type { Account } from '@/core/types';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, MoneyInput, TextInput } from '@/ui/Field';
import { pct0 } from '@/ui/format';
import { toast } from '@/ui/toast';
import { useAccountTargets } from '../accountTargets';

export const AccountTargetCard = ({
  account,
  currentBalance,
}: {
  account: Account;
  currentBalance: number;
}) => {
  const { targets, setTarget } = useAccountTargets();
  const existing = targets[account.id];
  const [editing, setEditing] = useState(false);
  const [amountDraft, setAmountDraft] = useState(
    existing ? String(existing.targetAmount) : '',
  );
  const [dateDraft, setDateDraft] = useState(existing?.targetDate ?? '');
  const [noteDraft, setNoteDraft] = useState(existing?.note ?? '');

  const openEditor = () => {
    setAmountDraft(existing ? String(existing.targetAmount) : '');
    setDateDraft(existing?.targetDate ?? '');
    setNoteDraft(existing?.note ?? '');
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const num = Number(amountDraft);
    if (!Number.isFinite(num) || num <= 0) return;
    setTarget(account.id, {
      targetAmount: Math.round(num * 100) / 100,
      targetDate: dateDraft.trim() || null,
      note: noteDraft.trim() || null,
    });
    setEditing(false);
    toast('Bucket target saved', 'success');
  };

  const remove = () => {
    setTarget(account.id, null);
    setEditing(false);
    toast('Target removed');
  };

  if (!existing && !editing) {
    return (
      <button
        type="button"
        onClick={openEditor}
        className="tap flex w-full items-center justify-between rounded-[var(--radius-card)] border border-dashed border-[var(--line)] bg-[var(--surface-raised)]/60 px-4 py-3 text-left transition hover:border-[var(--accent)]"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm">🎯</span>
          <div>
            <p className="text-xs font-bold text-[var(--text-strong)]">
              Set a target for {account.name}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Track progress toward car maintenance, insurance, holidays or an emergency fund.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent)]">
          + Set target
        </span>
      </button>
    );
  }

  if (editing) {
    return (
      <Card className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            🎯 Bucket target · {account.name}
          </span>
          {existing && (
            <button
              type="button"
              onClick={remove}
              className="tap text-xs font-semibold text-[var(--negative)]"
            >
              Remove target
            </button>
          )}
        </div>
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Labelled label="Target amount (€)">
              <MoneyInput
                value={amountDraft}
                placeholder="800.00"
                autoFocus
                onChange={setAmountDraft}
              />
            </Labelled>
            <Labelled label="Target date (optional)">
              <TextInput
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
              />
            </Labelled>
            <Labelled label="Purpose (optional)">
              <TextInput
                value={noteDraft}
                placeholder="Insurance + IUC, holidays…"
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </Labelled>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!(Number(amountDraft) > 0)}
            >
              Save target
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  const targetVal = existing!.targetAmount;
  const safeBal = Math.max(0, currentBalance);
  const ratio = targetVal > 0 ? safeBal / targetVal : 0;
  const remaining = Math.max(0, targetVal - safeBal);
  const reached = remaining <= 0.005;

  let monthlyNeeded: number | null = null;
  let monthsRemaining = 0;
  if (!reached && existing?.targetDate) {
    const [ty = 0, tm = 1, td = 1] = existing.targetDate.split('-').map(Number);
    const targetDt = new Date(ty, tm - 1, td, 12, 0, 0);
    const now = new Date();
    const diffDays = Math.max(
      1,
      Math.round((targetDt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );
    monthsRemaining = Math.max(1, Math.ceil(diffDays / 30));
    monthlyNeeded = remaining / monthsRemaining;
  }

  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm">🎯</span>
          <span className="truncate text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-strong)]">
            {existing?.note || 'Bucket target'}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums"
            style={{
              background: reached
                ? 'color-mix(in srgb, var(--positive) 18%, transparent)'
                : 'var(--accent-soft)',
              color: reached ? 'var(--positive)' : 'var(--accent)',
            }}
          >
            {pct0.format(Math.min(1, ratio))}
          </span>
        </div>
        <button
          type="button"
          onClick={openEditor}
          className="tap text-xs font-semibold text-[var(--accent)]"
        >
          Edit target
        </button>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full neu-sunken">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(2, ratio * 100))}%`,
            background: reached ? 'var(--positive)' : 'var(--accent)',
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-[var(--text-muted)]">
          <strong className="font-semibold text-[var(--text-strong)]">
            <AmountInline value={safeBal} />
          </strong>{' '}
          of <AmountInline value={targetVal} />
        </span>
        {reached ? (
          <span className="font-semibold text-[var(--positive)]">
            Target reached ✓
          </span>
        ) : (
          <span className="tabular-nums text-[var(--text-muted)]">
            <strong className="font-semibold text-[var(--text-2)]">
              <AmountInline value={remaining} />
            </strong>{' '}
            to go
            {monthlyNeeded !== null && (
              <>
                {' · '}
                <span className="font-semibold text-[var(--accent)]">
                  ~<AmountInline value={monthlyNeeded} />/mo
                </span>
              </>
            )}
          </span>
        )}
      </div>
    </Card>
  );
};
