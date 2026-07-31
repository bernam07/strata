import { useState, type FormEvent } from 'react';
import type { AccountType } from '@/core/types';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { institutions } from '../institutions';
import { useCreateAccount } from '../api/useAccounts';
import { InstitutionLogo } from './InstitutionLogo';

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'investment', label: 'Investimento' },
  { value: 'liability', label: 'Passivo' },
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
          Escolhe a instituição
        </span>
      </div>
      <Labelled label="Instituição">
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
      <Labelled label="Nome da conta">
        <TextInput
          value={name}
          required
          placeholder="Revolut principal"
          onChange={(event) => setName(event.target.value)}
        />
      </Labelled>
      <Labelled label="Tipo">
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
          Não foi possível criar a conta.
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={create.isPending}>
          Criar conta
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};
