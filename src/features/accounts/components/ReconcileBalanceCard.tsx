import { useMemo, useState } from 'react';
import type { Account } from '@/core/types';
import { useCreateTransaction } from '@/features/transactions/api/useTransactions';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { MoneyInput, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';

export const ReconcileBalanceCard = ({
  account,
  currentBalance,
}: {
  account: Account;
  currentBalance: number;
}) => {
  const createTx = useCreateTransaction();
  const [open, setOpen] = useState(false);
  const [realBalanceInput, setRealBalanceInput] = useState('');
  const [recordMode, setRecordMode] = useState<'adjustment' | 'cashflow'>(
    'adjustment',
  );
  const [note, setNote] = useState('');

  const delta = useMemo(() => {
    if (!realBalanceInput.trim()) return null;
    const parsed = Number(realBalanceInput.replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    const diff = Math.round((parsed - currentBalance) * 100) / 100;
    return Math.abs(diff) < 0.005 ? 0 : diff;
  }, [realBalanceInput, currentBalance]);

  const applyReconcile = () => {
    if (delta === null || delta === 0) return;

    const kind =
      recordMode === 'adjustment'
        ? 'adjustment'
        : delta < 0
          ? 'expense'
          : 'income';

    const defaultNote =
      recordMode === 'adjustment'
        ? 'Acerto de saldo'
        : delta < 0
          ? 'Despesa (acerto de saldo)'
          : 'Entrada (acerto de saldo)';

    createTx.mutate(
      {
        accountId: account.id,
        kind,
        amount: delta.toFixed(4),
        occurredAt: new Date().toISOString(),
        note: note.trim() || defaultNote,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setRealBalanceInput('');
          setNote('');
          toast('Saldo reconciliado com sucesso', 'success');
        },
        onError: () => toast('Não foi possível acertar o saldo', 'error'),
      },
    );
  };

  if (!open) {
    return (
      <div className="flex justify-end -mt-4">
        <button
          type="button"
          onClick={() => {
            setRealBalanceInput(currentBalance.toFixed(2));
            setOpen(true);
          }}
          className="tap inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--text-strong)]"
        >
          <span>⚖️</span>
          <span>Reconcile real balance</span>
        </button>
      </div>
    );
  }

  return (
    <Card className="page-enter flex min-w-0 flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Reconcile Real Balance
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Enter the exact balance shown in your bank app to auto-create the difference.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex min-w-0 flex-col justify-center gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            In Strata
          </span>
          <span className="truncate text-sm font-bold text-[var(--text-strong)]">
            <AmountInline value={currentBalance} />
          </span>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Difference
          </span>
          <span
            className="truncate text-sm font-bold"
            style={{
              color:
                delta === null || delta === 0
                  ? 'var(--text-muted)'
                  : delta > 0
                    ? 'var(--positive)'
                    : 'var(--negative)',
            }}
          >
            {delta === null || delta === 0 ? (
              '€0.00'
            ) : (
              <AmountInline value={delta} signed />
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Actual bank balance (€)
          </span>
          <MoneyInput
            autoFocus
            value={realBalanceInput}
            onChange={setRealBalanceInput}
            placeholder="0,00"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Note (optional)
          </span>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Acerto de saldo…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setRecordMode('adjustment')}
            className={`tap rounded-full px-2.5 py-1 transition-colors ${
              recordMode === 'adjustment'
                ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            Silent adjustment
          </button>
          <button
            type="button"
            onClick={() => setRecordMode('cashflow')}
            className={`tap rounded-full px-2.5 py-1 transition-colors ${
              recordMode === 'cashflow'
                ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            Count as {delta !== null && delta > 0 ? 'income' : 'expense'}
          </button>
        </div>

        <Button
          onClick={applyReconcile}
          disabled={createTx.isPending || delta === null || delta === 0}
        >
          {createTx.isPending ? 'Saving…' : 'Update balance'}
        </Button>
      </div>
    </Card>
  );
};
