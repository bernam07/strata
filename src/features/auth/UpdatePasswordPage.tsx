import { useState, type FormEvent } from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { StrataMark } from '@/app/icons';
import { useAuth } from './AuthProvider';

export const UpdatePasswordPage = () => {
  const { endRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    endRecovery();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <StrataMark size={44} />
          <span className="text-2xl font-extrabold tracking-[0.16em]">STRATA</span>
        </div>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-strong)]">
                Choose a new password
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Enter a new password for your account.
              </p>
            </div>
            <Labelled label="New password">
              <TextInput
                type="password"
                value={password}
                required
                autoFocus
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </Labelled>
            <Labelled label="Confirm password">
              <TextInput
                type="password"
                value={confirm}
                required
                autoComplete="new-password"
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Labelled>
            {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? 'Saving…' : 'Update password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
