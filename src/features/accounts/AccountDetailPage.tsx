import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Transaction } from '@/core/types';
import { balanceOf, deriveBalances } from '@/core/balances/deriveBalances';
import { isNegative, money, toNumber } from '@/core/money/money';
import { PageHero } from '@/ui/PageHero';
import { SectionTitle } from '@/ui/SectionTitle';
import {
  useAccounts,
  useDeleteAccount,
  useRenameAccount,
} from './api/useAccounts';
import {
  applyBrokerBalances,
  providerByInstitution,
  useBrokerAccounts,
} from './api/useBrokerAccounts';
import { getInstitution } from './institutions';
import { InstitutionLogo } from './components/InstitutionLogo';
import { AccountTargetCard } from './components/AccountTargetCard';
import { EdenredPaceCard } from './components/EdenredPaceCard';
import { ReconcileBalanceCard } from './components/ReconcileBalanceCard';
import { useAssignments } from '@/features/expenses/api/useCategories';
import {
  useDeleteTransaction,
  useReverseTransaction,
  useTransactions,
} from '@/features/transactions/api/useTransactions';
import {
  TransactionForm,
  type TransactionPrefill,
} from '@/features/transactions/components/TransactionForm';
import { useInstruments, usePositions } from '@/features/positions/api/usePositions';
import { PositionRow } from '@/features/positions/components/PositionRow';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { XtbCard } from '@/features/integrations/XtbCard';
import { useDeleteXtbHolding } from '@/features/integrations/api/useXtb';
import { Button } from '@/ui/Button';
import { BottomSheet } from '@/ui/BottomSheet';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { SkeletonRows } from '@/ui/Skeleton';
import { toast } from '@/ui/toast';

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
  const { data: assignments } = useAssignments();
  const reverse = useReverseTransaction();
  const delTx = useDeleteTransaction();
  const remove = useDeleteAccount();
  const rename = useRenameAccount();
  const deleteXtbHolding = useDeleteXtbHolding();
  const [adding, setAdding] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [prefill, setPrefill] = useState<TransactionPrefill | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const { data: brokers } = useBrokerAccounts();
  const { data: instruments } = useInstruments();
  const positionsQuery = usePositions();
  const account = accounts.find((entry) => entry.id === id);
  const isInvestment = account?.type === 'investment';
  const [historyOpen, setHistoryOpen] = useState(false);
  const brokerProvider = account
    ? providerByInstitution[account.institutionId]
    : undefined;
  const positions = isInvestment
    ? brokerProvider
      ? (positionsQuery.data?.byProvider.get(brokerProvider) ?? [])
      : (positionsQuery.data?.positions ?? [])
    : [];

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

  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);

  const onDelete = () => {
    if (!account) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast(`"${account.name}" deleted`);
        navigate('/accounts');
      },
    });
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
    reverse.mutate(transaction, {
      onSuccess: () => toast('Reversal entry added'),
      onError: () => toast("Couldn't reverse transaction", 'error'),
    });
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
    <div className="flex flex-col gap-6">
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
      </Card>

      <PageHero
        label={negative ? 'Owed' : 'Balance'}
        value={toNumber(balance)}
      />

      {account && !isInvestment && account.institutionId !== 'edenred' && (
        <AccountTargetCard
          account={account}
          currentBalance={toNumber(balance)}
        />
      )}

      {account && !isInvestment && (
        <ReconcileBalanceCard
          account={account}
          currentBalance={toNumber(balance)}
        />
      )}

      {account?.institutionId === 'edenred' && (
        <EdenredPaceCard
          account={account}
          balance={toNumber(balance)}
          transactions={transactions}
        />
      )}

      {account?.institutionId === 'xtb' && (
        <XtbCard accountId={account.id} compact />
      )}

      <BottomSheet
        open={Boolean(editingTx) && Boolean(account)}
        onClose={() => setEditingTx(null)}
        title="Edit movement"
      >
        {account && editingTx && (
          <TransactionForm
            accounts={accounts}
            existing={editingTx}
            onDone={() => setEditingTx(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={adding && Boolean(account)}
        onClose={() => {
          setAdding(false);
          setPrefill(null);
        }}
        title="Add movement"
      >
        {account && (
          <TransactionForm
            accounts={[account]}
            prefill={prefill ?? undefined}
            onDone={() => {
              setAdding(false);
              setPrefill(null);
            }}
          />
        )}
      </BottomSheet>

      {isInvestment && positions.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionTitle action={{ to: '/positions', label: 'Analytics' }}>
            Holdings
          </SectionTitle>
          <div className="flex flex-col gap-2">
            {positions
              .slice()
              .sort((a, b) =>
                (b.marketValue ?? b.costBasis).comparedTo(
                  a.marketValue ?? a.costBasis,
                ),
              )
              .map((position) => (
                <div
                  key={position.instrumentId}
                  className="flex flex-col gap-1"
                >
                  <PositionRow
                    position={position}
                    instrument={positionsQuery.data?.instruments.get(
                      position.instrumentId,
                    )}
                  />
                  {account?.institutionId === 'xtb' && (
                    <div className="flex justify-end px-2">
                      <button
                        type="button"
                        disabled={deleteXtbHolding.isPending}
                        onClick={() => {
                          const inst = positionsQuery.data?.instruments.get(
                            position.instrumentId,
                          );
                          const label = inst?.name ?? inst?.ticker ?? 'this holding';
                          if (window.confirm(`Remove ${label} from XTB holdings?`)) {
                            deleteXtbHolding.mutate(position.instrumentId, {
                              onSuccess: () => toast(`${label} removed`),
                            });
                          }
                        }}
                        className="tap text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                      >
                        Remove position
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-0.5">
          {isInvestment ? (
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              className="tap flex items-center gap-2"
            >
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Transaction history
              </span>
              <span
                className="text-[var(--text-muted)] transition-transform"
                style={{ transform: historyOpen ? 'rotate(90deg)' : 'none' }}
              >
                ›
              </span>
            </button>
          ) : (
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              History
            </h2>
          )}
          {!adding && account && (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              Add movement
            </Button>
          )}
        </div>
        {(!isInvestment || historyOpen) &&
          (isLoading ? (
            <SkeletonRows count={4} />
          ) : (
            <TransactionList
              transactions={transactions}
              accounts={account ? [account] : []}
              instruments={instruments}
              showAccount={false}
              onReverse={onReverse}
              onEdit={(tx) => {
                setAdding(false);
                setEditingTx(tx);
              }}
              onRepeat={(tx) => {
                setEditingTx(null);
                setPrefill({
                  account: tx.accountId,
                  kind: tx.kind,
                  amount: money(tx.amount).abs().toString(),
                  note: tx.note ?? undefined,
                  categoryId: assignments?.get(tx.id) ?? undefined,
                });
                setAdding(true);
              }}
              onDelete={(tx) => {
                delTx.mutate(tx.id, {
                  onSuccess: () => toast('Transaction deleted'),
                  onError: () => toast("Couldn't delete transaction", 'error'),
                });
              }}
            />
          ))}
      </div>

      {account && (
        <div className="mt-2 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-5">
          {confirmingDeleteAccount ? (
            <>
              <span className="text-xs text-[var(--text-muted)]">
                Delete &ldquo;{account.name}&rdquo; and all movements?
              </span>
              <button
                type="button"
                onClick={onDelete}
                disabled={remove.isPending}
                className="tap rounded-full bg-[var(--negative)] px-3 py-1.5 text-xs font-bold text-white"
              >
                {remove.isPending ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDeleteAccount(false)}
                className="tap rounded-full neu-flat px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDeleteAccount(true)}
              disabled={remove.isPending}
              className="tap text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
            >
              Delete account
            </button>
          )}
        </div>
      )}
    </div>
  );
};
