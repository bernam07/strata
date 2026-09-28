import { useState, type FormEvent } from 'react';
import type { AccountType } from '@/core/types';
import { Button } from '@/ui/Button';
import { Labelled, TextInput } from '@/ui/Field';
import { institutions } from '../institutions';
import { useCreateAccount } from '../api/useAccounts';
import { InstitutionLogo } from './InstitutionLogo';

const accountTypes: { value: AccountType; label: string; hint: string }[] = [
  { value: 'cash', label: 'Cash', hint: 'Bank / Meal card' },
  { value: 'investment', label: 'Investment', hint: 'Broker / ETFs' },
  { value: 'liability', label: 'Liability', hint: 'Credit / Loan' },
];

export const AccountForm = ({ onDone }: { onDone: () => void }) => {
  const create = useCreateAccount();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [institutionId, setInstitutionId] = useState(institutions[0]!.id);

  const pickInstitution = (id: string) => {
    setInstitutionId(id);
    if (id === 'trading212' || id === 'trade_republic') {
      setType('investment');
    } else if (id === 'edenred' || id === 'cash') {
      setType('cash');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name, type, institutionId },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Institution
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {institutions.map((institution) => {
            const active = institution.id === institutionId;
            return (
              <button
                key={institution.id}
                type="button"
                onClick={() => pickInstitution(institution.id)}
                className={`tap flex items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-left transition ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                    : 'neu-flat text-[var(--text-2)] hover:text-[var(--text-strong)]'
                }`}
              >
                <InstitutionLogo institutionId={institution.id} size={24} />
                <span className="truncate text-xs font-semibold">
                  {institution.displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Labelled label="Account name">
        <TextInput
          value={name}
          required
          placeholder={
            institutionId === 'edenred' ? 'Cartão Refeição' : 'Main Revolut'
          }
          onChange={(event) => setName(event.target.value)}
        />
      </Labelled>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Type
        </span>
        <div className="grid grid-cols-3 gap-2">
          {accountTypes.map((option) => {
            const active = option.value === type;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`tap flex flex-col items-start rounded-[var(--radius-field)] px-3 py-2.5 text-left transition ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                    : 'neu-flat text-[var(--text-2)] hover:text-[var(--text-strong)]'
                }`}
              >
                <span className="text-xs font-bold">{option.label}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {create.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't create the account.
        </p>
      )}
      <div className="mt-1 flex gap-3">
        <Button type="submit" disabled={create.isPending}>
          Create account
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
