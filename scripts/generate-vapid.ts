// Generate a VAPID key pair for Web Push.
// Run with: deno run scripts/generate-vapid.ts
//
// Outputs three values:
//   VAPID_KEYS            → secret for the `market` edge function
//   VAPID_SUBJECT         → secret for the `market` edge function (edit the email)
//   VITE_VAPID_PUBLIC_KEY → Vite env var for the web app (public)

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);

const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);

const x = fromBase64Url(publicKey.x!);
const y = fromBase64Url(publicKey.y!);
const raw = new Uint8Array(1 + x.length + y.length);
raw[0] = 4;
raw.set(x, 1);
raw.set(y, 1 + x.length);

console.log('VAPID_KEYS=' + JSON.stringify({ publicKey, privateKey }));
console.log('VAPID_SUBJECT=mailto:you@example.com');
console.log('VITE_VAPID_PUBLIC_KEY=' + toBase64Url(raw));
