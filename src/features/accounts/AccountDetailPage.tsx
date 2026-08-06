import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Transaction } from '@/core/types';
import { balanceOf, deriveBalances } from '@/core/balances/deriveBalances';
import { formatEur, isNegative } from '@/core/money/money';
import {
  useAccounts,
  useDeleteAccount,
  useRenameAccount,
} from './api/useAccounts';
import { applyBrokerBalances, useBrokerAccounts } from './api/useBrokerAccounts';
import { getInstitution } from './institutions';
import { InstitutionLogo } from './components/InstitutionLogo';
import {
  useReverseTransaction,
  useTransactions,
} from '@/features/transactions/api/useTransactions';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { useInstruments } from '@/features/positions/api/usePositions';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { SkeletonRows } from '@/ui/Skeleton';

const typeLabel: Record<string, string> = {
  cash: 'Cash',
  investment: 'Investment',
  liability: 'Liability',
};

export const AccountDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: transactions = [], isLoading } = useTransactions({
    accountId: id,
  });
  const reverse = useReverseTransaction();
  const remove = useDeleteAccount();
  const rename = useRenameAccount();
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const { data: brokers } = useBrokerAccounts();
  const { data: instruments } = useInstruments();
  const account = accounts.find((entry) => entry.id === id);

  const startRename = () => {
    if (!account) return;
    setNameDraft(account.name);
    setEditingName(true);
  };
  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === account?.name) {
      setEditingName(false);
      return;
    }
    rename.mutate({ id, name: trimmed }, { onSuccess: () => setEditingName(false) });
  };

  const onDelete = () => {
    if (!account) return;
    if (
      window.confirm(
        `Delete "${account.name}"? This permanently removes the account and all of its transactions. This cannot be undone.`,
      )
    ) {
      remove.mutate(id, { onSuccess: () => navigate('/accounts') });
    }
  };
  const balance = useMemo(() => {
    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      account ? [account] : [],
      brokers ?? new Map(),
    );
    return balanceOf(balances, id);
  }, [transactions, id, account, brokers]);

  const onReverse = (transaction: Transaction) => {
    if (
      window.confirm(
        'Reverse this entry? A matching adjustment will be added — the original stays in the ledger.',
      )
    ) {
      reverse.mutate(transaction);
    }
  };

  if (!accountsLoading && !account) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)]">Account not found.</p>
        <Link to="/accounts" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to accounts
        </Link>
      </div>
    );
  }

  const negative = isNegative(balance);

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/accounts"
        className="tap text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
      >
        ← Accounts
      </Link>

      <Card className="flex items-center gap-4">
        {account && (
          <InstitutionLogo institutionId={account.institutionId} size={52} />
        )}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <TextInput
                value={nameDraft}
                autoFocus
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveName();
                  if (event.key === 'Escape') setEditingName(false);
                }}
              />
              <Button onClick={saveName} disabled={rename.isPending}>
                Save
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startRename}
              disabled={!account}
              className="tap flex items-center gap-2 text-left"
            >
              <h1 className="truncate text-xl font-bold text-[var(--text-strong)]">
                {account?.name ?? '…'}
              </h1>
              <span className="text-xs text-[var(--text-muted)]">✎</span>
            </button>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            {account
              ? `${getInstitution(account.institutionId).displayName} · ${typeLabel[account.type]}`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Balance
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: negative ? 'var(--negative)' : 'var(--text-strong)' }}
          >
            {formatEur(balance)}
          </p>
        </div>
      </Card>

      {adding && account && (
        <Card>
          <TransactionForm
            accounts={[account]}
            onDone={() => setAdding(false)}
          />
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            History
          </h2>
          {!adding && account && (
            <Button variant="ghost" onClick={() => setAdding(true)}>
              Add movement
            </Button>
          )}
        </div>
        {isLoading ? (
          <SkeletonRows count={4} />
        ) : (
          <TransactionList
            transactions={transactions}
            accounts={account ? [account] : []}
            instruments={instruments}
            showAccount={false}
            onReverse={onReverse}
          />
        )}
      </div>

      {account && (
        <div className="mt-2 flex justify-end border-t border-[var(--line)] pt-5">
          <button
            type="button"
            onClick={onDelete}
            disabled={remove.isPending}
            className="tap text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
          >
            Delete account
          </button>
        </div>
      )}
    </div>
  );
};
