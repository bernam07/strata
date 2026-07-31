import { useState, type FormEvent } from 'react';
import type { AccountType } from '@/core/types';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { institutions } from '../institutions';
import { useCreateAccount } from '../api/useAccounts';
import { InstitutionLogo } from './InstitutionLogo';

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'liability', label: 'Liability' },
];

export const AccountForm = ({ onDone }: { onDone: () => void }) => {
  const create = useCreateAccount();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [institutionId, setInstitutionId] = useState(institutions[0]!.id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name, type, institutionId },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <InstitutionLogo institutionId={institutionId} />
        <span className="text-sm text-[var(--text-muted)]">
          Choose an institution
        </span>
      </div>
      <Labelled label="Institution">
        <Select
          value={institutionId}
          onChange={(event) => setInstitutionId(event.target.value)}
        >
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.displayName}
            </option>
          ))}
        </Select>
      </Labelled>
      <Labelled label="Account name">
        <TextInput
          value={name}
          required
          placeholder="Main Revolut"
          onChange={(event) => setName(event.target.value)}
        />
      </Labelled>
      <Labelled label="Type">
        <Select
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
        >
          {accountTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Labelled>
      {create.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't create the account.
        </p>
      )}
      <div className="mt-2 flex gap-3">
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
