import { useState, type FormEvent } from 'react';
import { supabase } from '@/db/supabase';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { StrataMark } from '@/app/icons';

type Mode = 'signin' | 'signup' | 'reset';

export const LoginPage = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    if (mode === 'reset') {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: window.location.origin },
      );
      setPending(false);
      if (authError) setError(authError.message);
      else setNotice('Check your email for a link to reset your password.');
      return;
    }

    const action =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error: authError } = await action;
    if (authError) setError(authError.message);
    else if (mode === 'signup')
      setNotice('Account created. Check your email to confirm, then sign in.');
    setPending(false);
  };

  const cta =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'signup'
        ? 'Create account'
        : 'Send reset link';

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
            {mode === 'reset' && (
              <p className="text-sm text-[var(--text-muted)]">
                Enter your email and we'll send you a link to reset your
                password.
              </p>
            )}
            <Labelled label="Email">
              <TextInput
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Labelled>
            {mode !== 'reset' && (
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
            )}
            {mode === 'signin' && (
              <button
                type="button"
                className="tap -mt-1 self-end text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                onClick={() => switchTo('reset')}
              >
                Forgot password?
              </button>
            )}
            {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
            {notice && (
              <p className="text-sm text-[var(--positive)]">{notice}</p>
            )}
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? 'Please wait…' : cta}
            </Button>
          </form>
          <button
            type="button"
            className="tap mt-4 w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            onClick={() =>
              switchTo(
                mode === 'signin'
                  ? 'signup'
                  : mode === 'signup'
                    ? 'signin'
                    : 'signin',
              )
            }
          >
            {mode === 'signin'
              ? "Don't have an account? Create one."
              : mode === 'signup'
                ? 'Already have an account? Sign in.'
                : '← Back to sign in'}
          </button>
        </Card>
      </div>
    </div>
  );
};
