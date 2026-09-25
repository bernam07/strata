import { useEffect, useState } from 'react';

const ENABLED_KEY = 'strata-biometric-enabled';
const CRED_KEY = 'strata-biometric-cred';

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
};

const fromBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const readEnabled = (): boolean => {
  try {
    return (
      localStorage.getItem(ENABLED_KEY) === '1' &&
      Boolean(localStorage.getItem(CRED_KEY))
    );
  } catch {
    return false;
  }
};

let enabled = readEnabled();
let locked = enabled;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

export const isBiometricSupported = async (): Promise<boolean> => {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext ||
    typeof window.PublicKeyCredential === 'undefined' ||
    !navigator.credentials
  ) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

export const isBiometricEnabled = (): boolean => enabled;
export const isAppLocked = (): boolean => locked;

export const lockApp = (): void => {
  if (!enabled) return;
  locked = true;
  notify();
};

export const unlockApp = (): void => {
  locked = false;
  notify();
};

export const disableBiometric = (): void => {
  enabled = false;
  locked = false;
  try {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(CRED_KEY);
  } catch {
    // ignore storage errors
  }
  notify();
};

export const registerBiometric = async (userLabel: string): Promise<boolean> => {
  const supported = await isBiometricSupported();
  if (!supported) {
    throw new Error('Biometric authentication is not supported on this device/browser.');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const label = userLabel.trim() || 'Strata User';

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Strata',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: label,
        displayName: label,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) return false;

  const credBase64 = toBase64(credential.rawId);
  try {
    localStorage.setItem(CRED_KEY, credBase64);
    localStorage.setItem(ENABLED_KEY, '1');
  } catch {
    throw new Error('Could not save biometric preference.');
  }

  enabled = true;
  locked = false;
  notify();
  return true;
};

export const verifyBiometric = async (): Promise<boolean> => {
  const credBase64 = localStorage.getItem(CRED_KEY);
  if (!credBase64) {
    disableBiometric();
    return true;
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const rawId = fromBase64(credBase64);

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: rawId.buffer as ArrayBuffer,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  if (assertion) {
    locked = false;
    notify();
    return true;
  }
  return false;
};

export const useBiometricLock = () => {
  const [state, setState] = useState({ enabled, locked });

  useEffect(() => {
    const onUpdate = () => setState({ enabled, locked });
    listeners.add(onUpdate);
    onUpdate();
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  return state;
};
