import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { useAccounts } from './api/useAccounts';
import { AccountForm } from './components/AccountForm';
import { InstitutionLogo } from './components/InstitutionLogo';
import { getInstitution } from './institutions';

const typeLabel: Record<string, string> = {
  cash: 'Dinheiro',
  investment: 'Investimento',
  liability: 'Passivo',
};

export const AccountsPage = () => {
  const { data: accounts, isLoading } = useAccounts();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Contas</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>Nova conta</Button>
        )}
      </div>

      {creating && (
        <Card>
          <AccountForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">A carregar…</p>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <Surface
              key={account.id}
              elevation="raised"
              className="flex items-center gap-4 p-5"
            >
              <InstitutionLogo institutionId={account.institutionId} />
              <div>
                <p className="font-semibold text-[var(--text-strong)]">
                  {account.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {getInstitution(account.institutionId).displayName} ·{' '}
                  {typeLabel[account.type]}
                </p>
              </div>
            </Surface>
          ))}
        </div>
      ) : (
        !creating && (
          <p className="text-sm text-[var(--text-muted)]">
            Ainda não tens contas.
          </p>
        )
      )}
    </div>
  );
};
