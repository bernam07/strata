// Generate a VAPID key pair for Web Push.
// Run with: node scripts/generate-vapid.mjs
//
// Outputs three values:
//   VAPID_KEYS            → secret for the `market` edge function (Supabase)
//   VAPID_SUBJECT         → secret for the `market` edge function (edit the email)
//   VITE_VAPID_PUBLIC_KEY → env var for the web app (Vercel, public)

const toBase64Url = (bytes) =>
  Buffer.from(bytes).toString('base64url');

const fromBase64Url = (value) =>
  new Uint8Array(Buffer.from(value, 'base64url'));

const pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);

const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);

const x = fromBase64Url(publicKey.x);
const y = fromBase64Url(publicKey.y);
const raw = new Uint8Array(1 + x.length + y.length);
raw[0] = 4;
raw.set(x, 1);
raw.set(y, 1 + x.length);

console.log('VAPID_KEYS=' + JSON.stringify({ publicKey, privateKey }));
console.log('VAPID_SUBJECT=mailto:you@example.com');
console.log('VITE_VAPID_PUBLIC_KEY=' + toBase64Url(raw));
