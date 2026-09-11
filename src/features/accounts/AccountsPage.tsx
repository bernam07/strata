import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { balanceOf, deriveBalances } from '@/core/balances/deriveBalances';
import { isNegative, toNumber, type Money, sum } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
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

  const balanceById = useMemo(() => {
    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      accounts ?? [],
      brokers ?? new Map(),
    );
    return (accountId: string) => balanceOf(balances, accountId);
  }, [accounts, transactions, brokers]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Accounts"
        subtitle="Every place your money lives."
        actions={
          !creating && (
            <Button onClick={() => setCreating(true)}>New account</Button>
          )
        }
      />

      {creating && (
        <Card>
          <AccountForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : accounts && accounts.length > 0 ? (
        <div className="flex flex-col gap-6">
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
                  {group.accounts.map((account) => (
                    <Link key={account.id} to={`/accounts/${account.id}`}>
                      <Surface
                        elevation="raised"
                        className="tap flex items-center gap-4 p-5 hover:border-[var(--accent)]"
                      >
                        <InstitutionLogo institutionId={account.institutionId} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[var(--text-strong)]">
                            {account.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {institution.displayName} · {typeLabel[account.type]}
                          </p>
                        </div>
                        <Balance value={balanceById(account.id)} />
                      </Surface>
                    </Link>
                  ))}
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
