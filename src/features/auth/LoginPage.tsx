import { useState, type FormEvent } from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { StrataMark } from '@/app/icons';

type Mode = 'signin' | 'signup';

export const LoginPage = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const action =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error: authError } = await action;
    if (authError) setError(authError.message);
    setPending(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <StrataMark size={44} />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-extrabold tracking-[0.16em]">
              STRATA
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              Your wealth, layer by layer.
            </span>
          </div>
        </div>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Labelled label="Email">
              <TextInput
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Labelled>
            <Labelled label="Password">
              <TextInput
                type="password"
                value={password}
                required
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                onChange={(event) => setPassword(event.target.value)}
              />
            </Labelled>
            {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
            <Button type="submit" disabled={pending} className="mt-2">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
          <button
            type="button"
            className="tap mt-4 w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            onClick={() =>
              setMode((current) =>
                current === 'signin' ? 'signup' : 'signin',
              )
            }
          >
            {mode === 'signin'
              ? "Don't have an account? Create one."
              : 'Already have an account? Sign in.'}
          </button>
        </Card>
      </div>
    </div>
  );
};
