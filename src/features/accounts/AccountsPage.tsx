import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { SkeletonRows } from '@/ui/Skeleton';
import { useAccounts } from './api/useAccounts';
import { AccountForm } from './components/AccountForm';
import { InstitutionLogo } from './components/InstitutionLogo';
import { getInstitution } from './institutions';

const typeLabel: Record<string, string> = {
  cash: 'Cash',
  investment: 'Investment',
  liability: 'Liability',
};

export const AccountsPage = () => {
  const { data: accounts, isLoading } = useAccounts();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Accounts
        </h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>New account</Button>
        )}
      </div>

      {creating && (
        <Card>
          <AccountForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : accounts && accounts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
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
                    {getInstitution(account.institutionId).displayName} ·{' '}
                    {typeLabel[account.type]}
                  </p>
                </div>
                <span className="text-[var(--text-muted)]">›</span>
              </Surface>
            </Link>
          ))}
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
