import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { balanceOf, deriveBalances } from '@/core/balances/deriveBalances';
import { isNegative, toNumber, type Money, sum } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { BottomSheet } from '@/ui/BottomSheet';
import { pct0, pctMax1 } from '@/ui/format';
import { PageHero } from '@/ui/PageHero';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { TransferForm } from '@/features/transactions/components/TransferForm';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { useAccounts } from './api/useAccounts';
import { applyBrokerBalances, useBrokerAccounts } from './api/useBrokerAccounts';
import { AccountForm } from './components/AccountForm';
import { getEdenredMonthStats } from './components/EdenredPaceCard';
import { InstitutionLogo } from './components/InstitutionLogo';
import { PaydaySplitForm } from './components/PaydaySplitForm';
import { useAccountTargets } from './accountTargets';
import { getInstitution } from './institutions';
import type { Account } from '@/core/types';

const typeLabel: Record<string, string> = {
  cash: 'Cash',
  investment: 'Investment',
  liability: 'Liability',
};

const SUB_ACCOUNT_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#A855F7',
  '#EC4899',
  '#06B6D4',
];

interface Group {
  institutionId: string;
  accounts: Account[];
  total: Money;
}

const Balance = ({ value }: { value: Money }) => (
  <span
    className="shrink-0 text-sm font-semibold"
    style={{ color: isNegative(value) ? 'var(--negative)' : 'var(--text-strong)' }}
  >
    <AmountInline value={toNumber(value)} />
  </span>
);

export const AccountsPage = () => {
  const { data: accounts, isLoading } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: brokers } = useBrokerAccounts();
  const { targets: accountTargets } = useAccountTargets();
  const [creating, setCreating] = useState(false);
  const [movingGroup, setMovingGroup] = useState<Group | null>(null);
  const [splittingGroup, setSplittingGroup] = useState<Group | null>(null);

  const groups = useMemo<Group[]>(() => {
    const list = accounts ?? [];
    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      list,
      brokers ?? new Map(),
    );
    const byInstitution = new Map<string, Account[]>();
    for (const account of list) {
      const bucket = byInstitution.get(account.institutionId) ?? [];
      bucket.push(account);
      byInstitution.set(account.institutionId, bucket);
    }
    return [...byInstitution.entries()].map(([institutionId, grouped]) => ({
      institutionId,
      accounts: grouped,
      total: sum(grouped.map((account) => balanceOf(balances, account.id))),
    }));
  }, [accounts, transactions, brokers]);

  const netTotal = useMemo(
    () => sum(groups.map((group) => group.total)),
    [groups],
  );

  const balanceById = useMemo(() => {
    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      accounts ?? [],
      brokers ?? new Map(),
    );
    return (accountId: string) => balanceOf(balances, accountId);
  }, [accounts, transactions, brokers]);

  const positiveTotal = useMemo(() => {
    let total = 0;
    for (const account of accounts ?? []) {
      const bal = toNumber(balanceById(account.id));
      if (bal > 0) total += bal;
    }
    return total;
  }, [accounts, balanceById]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounts"
        subtitle="Every place your money lives."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            New account
          </Button>
        }
      />

      <BottomSheet
        open={creating}
        title="New account"
        subtitle="Add a bank, broker or meal card."
        onClose={() => setCreating(false)}
      >
        <AccountForm onDone={() => setCreating(false)} />
      </BottomSheet>

      <BottomSheet
        open={movingGroup !== null}
        title={
          movingGroup
            ? `Move between ${getInstitution(movingGroup.institutionId).displayName} buckets`
            : 'Move between buckets'
        }
        subtitle="Reallocate money across your sub-accounts while keeping the bank total intact."
        onClose={() => setMovingGroup(null)}
      >
        {movingGroup && (
          <TransferForm
            accounts={movingGroup.accounts}
            onDone={() => setMovingGroup(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={splittingGroup !== null}
        title={
          splittingGroup
            ? `Payday Split · ${getInstitution(splittingGroup.institutionId).displayName}`
            : 'Payday Split'
        }
        subtitle="Distribute your paycheck across virtual buckets in one step."
        onClose={() => setSplittingGroup(null)}
      >
        {splittingGroup && (
          <PaydaySplitForm
            institutionId={splittingGroup.institutionId}
            accounts={splittingGroup.accounts}
            onDone={() => setSplittingGroup(null)}
          />
        )}
      </BottomSheet>

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : accounts && accounts.length > 0 ? (
        <div className="flex flex-col gap-5">
          <PageHero
            label="Total balance"
            value={toNumber(netTotal)}
            sub={`Across ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
          />
          {groups.map((group) => {
            const institution = getInstitution(group.institutionId);
            const many = group.accounts.length > 1;
            const groupPositiveSum = group.accounts.reduce((acc, a) => {
              const v = toNumber(balanceById(a.id));
              return v > 0 ? acc + v : acc;
            }, 0);

            return (
              <section key={group.institutionId} className="flex flex-col gap-3">
                {many && (
                  <div className="flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-raised)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <InstitutionLogo
                          institutionId={group.institutionId}
                          size={28}
                        />
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-strong)]">
                            {institution.displayName}
                          </span>
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {group.accounts.length} virtual buckets · Real bank total:{' '}
                            <strong className="font-bold text-[var(--text-strong)]">
                              <AmountInline value={toNumber(group.total)} />
                            </strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSplittingGroup(group)}
                          className="tap shrink-0 rounded-full bg-[var(--positive)]/15 px-3 py-1 text-xs font-bold text-[var(--positive)]"
                        >
                          ＋ Payday Split
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovingGroup(group)}
                          className="tap shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]"
                        >
                          ⇄ Reallocate
                        </button>
                      </div>
                    </div>

                    {groupPositiveSum > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                          {group.accounts.map((acc, idx) => {
                            const val = Math.max(0, toNumber(balanceById(acc.id)));
                            if (val <= 0) return null;
                            const share = (val / groupPositiveSum) * 100;
                            const color =
                              SUB_ACCOUNT_PALETTE[
                                idx % SUB_ACCOUNT_PALETTE.length
                              ]!;
                            return (
                              <div
                                key={acc.id}
                                style={{ width: `${share}%`, background: color }}
                                className="h-full transition-all duration-300"
                                title={`${acc.name}: ${pct0.format(val / groupPositiveSum)}`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {group.accounts.map((acc, idx) => {
                            const val = Math.max(0, toNumber(balanceById(acc.id)));
                            if (val <= 0) return null;
                            const color =
                              SUB_ACCOUNT_PALETTE[
                                idx % SUB_ACCOUNT_PALETTE.length
                              ]!;
                            return (
                              <span
                                key={acc.id}
                                className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"
                              >
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: color }}
                                />
                                <span className="font-semibold text-[var(--text-2)]">
                                  {acc.name}
                                </span>
                                <span className="tabular-nums">
                                  {pct0.format(val / groupPositiveSum)}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.accounts.map((account, idx) => {
                    const bal = balanceById(account.id);
                    const balNum = toNumber(bal);
                    const weight =
                      positiveTotal > 0 && balNum > 0
                        ? balNum / positiveTotal
                        : 0;
                    const brand =
                      institution.brandColor && institution.brandColor !== '#111111'
                        ? institution.brandColor
                        : 'var(--accent)';
                    const bucketColor =
                      SUB_ACCOUNT_PALETTE[idx % SUB_ACCOUNT_PALETTE.length]!;
                    const accentColor = many ? bucketColor : brand;
                    const edenredStats =
                      account.institutionId === 'edenred' && balNum > 0
                        ? getEdenredMonthStats(balNum)
                        : null;
                    const target = accountTargets[account.id];
                    const targetRatio =
                      target && target.targetAmount > 0
                        ? Math.max(0, balNum) / target.targetAmount
                        : null;
                    const barRatio =
                      targetRatio !== null ? targetRatio : weight;
                    return (
                      <Link
                        key={account.id}
                        to={`/accounts/${account.id}`}
                        className="block min-w-0"
                      >
                        <div
                          className="tap relative flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-4 sm:p-5 transition hover:border-[var(--accent)]"
                          style={{
                            background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${accentColor} 13%, var(--surface-raised)) 0%, var(--surface-raised) 68%)`,
                            border:
                              '1px solid color-mix(in srgb, var(--line) 86%, transparent)',
                            boxShadow: 'var(--shadow)',
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-3.5">
                            <InstitutionLogo
                              institutionId={account.institutionId}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                {many && (
                                  <span
                                    aria-hidden="true"
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: bucketColor }}
                                  />
                                )}
                                <p className="truncate font-semibold text-[var(--text-strong)]">
                                  {account.name}
                                </p>
                              </div>
                              <p className="truncate text-xs text-[var(--text-muted)]">
                                {institution.displayName} ·{' '}
                                {typeLabel[account.type]}
                                {weight > 0
                                  ? ` · ${pctMax1.format(weight)}`
                                  : ''}
                              </p>
                              {edenredStats && (
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--positive)]">
                                  <AmountInline value={edenredStats.perWorkingDay} />
                                  /workday · {edenredStats.remainingWorkingDays}d left
                                </p>
                              )}
                              {target && targetRatio !== null && (
                                <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--accent)]">
                                  🎯 {target.note ? `${target.note}: ` : 'Target: '}
                                  <AmountInline value={Math.max(0, balNum)} /> /{' '}
                                  <AmountInline value={target.targetAmount} /> (
                                  {pct0.format(Math.min(1, targetRatio))})
                                </p>
                              )}
                            </div>
                            <Balance value={bal} />
                          </div>
                          {barRatio > 0 && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(3, Math.min(100, barRatio * 100))}%`,
                                  background:
                                    targetRatio !== null
                                      ? targetRatio >= 1
                                        ? 'var(--positive)'
                                        : accentColor
                                      : accentColor,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        !creating && (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--text-muted)]">
              No accounts yet. Add your first bank or broker to start tracking.
            </p>
            <Button onClick={() => setCreating(true)}>New account</Button>
          </Card>
        )
      )}
    </div>
  );
};
