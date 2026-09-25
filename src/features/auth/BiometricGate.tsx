import { useEffect, useRef, useState } from 'react';
import { StrataMark } from '@/app/icons';
import { Button } from '@/ui/Button';
import { useAuth } from './AuthProvider';
import {
  disableBiometric,
  lockApp,
  useBiometricLock,
  verifyBiometric,
} from './biometricLock';

const AUTO_LOCK_MS = 2 * 60 * 1000; // 2 minutes in background

export const BiometricGate = () => {
  const { enabled, locked } = useBiometricLock();
  const { signOut } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const autoPromptedRef = useRef(false);

  // Auto-lock after 2 minutes in the background
  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current !== null) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (elapsed >= AUTO_LOCK_MS) {
          lockApp();
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  const handleUnlock = async () => {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyBiometric();
    } catch {
      setError('Authentication cancelled or failed. Tap below to try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Automatically trigger FaceID/Biometrics once when the lock screen appears
  useEffect(() => {
    if (locked && !autoPromptedRef.current) {
      autoPromptedRef.current = true;
      const t = setTimeout(() => {
        void handleUnlock();
      }, 150);
      return () => clearTimeout(t);
    }
    if (!locked) {
      autoPromptedRef.current = false;
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  if (!enabled || !locked) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg)]/96 px-6 text-center backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Strata"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-raised)] p-7 shadow-2xl">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-sunken)] shadow-inner">
          <StrataMark size={34} />
          <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-raised)] text-[var(--accent)]">
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-extrabold tracking-tight text-[var(--text-strong)]">
            Strata Locked
          </h2>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Verify with Face ID or biometrics to view your portfolio and balances.
          </p>
        </div>

        {error && (
          <p className="rounded-[var(--radius-field)] bg-[color-mix(in_srgb,var(--negative)_12%,transparent)] px-3 py-2 text-xs text-[var(--negative)]">
            {error}
          </p>
        )}

        <div className="flex w-full flex-col gap-2.5">
          <Button
            onClick={() => void handleUnlock()}
            disabled={verifying}
            className="w-full justify-center"
          >
            {verifying ? 'Verifying…' : 'Unlock with Biometrics'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              disableBiometric();
              void signOut();
            }}
            className="w-full justify-center text-xs text-[var(--text-muted)]"
          >
            Sign out instead
          </Button>
        </div>
      </div>
    </div>
  );
};
