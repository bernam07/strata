import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { balanceOf, deriveBalances } from '@/core/balances/deriveBalances';
import { isNegative, toNumber, type Money, sum } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { BottomSheet } from '@/ui/BottomSheet';
import { pctMax1 } from '@/ui/format';
import { PageHero } from '@/ui/PageHero';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { useAccounts } from './api/useAccounts';
import { applyBrokerBalances, useBrokerAccounts } from './api/useBrokerAccounts';
import { AccountForm } from './components/AccountForm';
import { InstitutionLogo } from './components/InstitutionLogo';
import { getInstitution } from './institutions';
import type { Account } from '@/core/types';

const typeLabel: Record<string, string> = {
  cash: 'Cash',
  investment: 'Investment',
  liability: 'Liability',
};

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
  const [creating, setCreating] = useState(false);

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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Accounts"
        subtitle="Every place your money lives."
        actions={
          <Button onClick={() => setCreating(true)}>New account</Button>
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

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : accounts && accounts.length > 0 ? (
        <div className="flex flex-col gap-6">
          <PageHero
            label="Total balance"
            value={toNumber(netTotal)}
            sub={`Across ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
          />
          {groups.map((group) => {
            const institution = getInstitution(group.institutionId);
            const many = group.accounts.length > 1;
            return (
              <section key={group.institutionId} className="flex flex-col gap-2.5">
                {many && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {institution.displayName}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      Combined <Balance value={group.total} />
                    </span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.accounts.map((account) => {
                    const bal = balanceById(account.id);
                    const balNum = toNumber(bal);
                    const weight =
                      positiveTotal > 0 && balNum > 0
                        ? balNum / positiveTotal
                        : 0;
                    const brand = institution.brandColor || 'var(--accent)';
                    return (
                      <Link key={account.id} to={`/accounts/${account.id}`}>
                        <div
                          className="tap relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-5 transition hover:border-[var(--accent)]"
                          style={{
                            background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${brand} 13%, var(--surface-raised)) 0%, var(--surface-raised) 68%)`,
                            border:
                              '1px solid color-mix(in srgb, var(--line) 86%, transparent)',
                            boxShadow: 'var(--shadow)',
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <InstitutionLogo
                              institutionId={account.institutionId}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[var(--text-strong)]">
                                {account.name}
                              </p>
                              <p className="truncate text-xs text-[var(--text-muted)]">
                                {institution.displayName} ·{' '}
                                {typeLabel[account.type]}
                                {weight > 0
                                  ? ` · ${pctMax1.format(weight)}`
                                  : ''}
                              </p>
                            </div>
                            <Balance value={bal} />
                          </div>
                          {weight > 0 && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(3, Math.min(100, weight * 100))}%`,
                                  background: brand,
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
