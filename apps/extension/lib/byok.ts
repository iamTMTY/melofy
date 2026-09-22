import { MELOFY_API_BASE } from './config';

const BYOK_KEY = 'melofy:byok-key';

export async function getStoredKey(): Promise<string | null> {
  const r = await browser.storage.local.get(BYOK_KEY);
  return (r[BYOK_KEY] as string) || null;
}
export async function setStoredKey(key: string): Promise<void> {
  await browser.storage.local.set({ [BYOK_KEY]: key.trim() });
}
export async function clearStoredKey(): Promise<void> {
  await browser.storage.local.remove(BYOK_KEY);
}
export async function hasStoredKey(): Promise<boolean> {
  return !!(await getStoredKey());
}

let pubKeyCache: CryptoKey | null = null;

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  return fromB64(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
}

async function getServerPublicKey(force = false): Promise<CryptoKey> {
  if (pubKeyCache && !force) return pubKeyCache;
  const res = await fetch(`${MELOFY_API_BASE}/api/byok/pubkey`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not fetch encryption key');
  const { publicKey } = (await res.json()) as { publicKey: string };
  pubKeyCache = await crypto.subtle.importKey(
    'spki',
    pemToDer(publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  return pubKeyCache;
}

export async function getEncryptedKey(): Promise<string | null> {
  const raw = await getStoredKey();
  if (!raw) return null;
  try {
    const pub = await getServerPublicKey();
    const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new TextEncoder().encode(raw));
    return toB64(ct);
  } catch {
    return null;
  }
}
