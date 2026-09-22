// At rest ("remember on this device"): the key is encrypted with AES-GCM using a
//   NON-EXTRACTABLE CryptoKey kept in IndexedDB, and the ciphertext lives in
//   localStorage. A snoop in DevTools sees ciphertext, not the key. (This does
//   NOT defend against XSS — nothing client-side can — only passive reads.)
// Session-only ("don't remember"): the key stays in memory and is gone on reload.
// In transit: the key is RSA-OAEP-encrypted for the server's public key before it
//   ever leaves the browser (belt-and-suspenders over HTTPS; keeps it out of logs).
// The plaintext key is NEVER sent to, or stored by, the server.

const LS_KEY = 'melofy-byok';
const IDB_NAME = 'melofy-byok';
const IDB_STORE = 'keys';
const WRAP_ID = 'wrap';

const isBrowser = () => typeof window !== 'undefined' && !!window.crypto?.subtle;

let sessionKey: string | null = null;

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function getOrCreateWrapKey(): Promise<CryptoKey> {
  const db = await openKeyDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(WRAP_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(key, WRAP_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return key;
}

export function hasApiKey(): boolean {
  if (sessionKey) return true;
  return isBrowser() && !!localStorage.getItem(LS_KEY);
}

export function isRemembered(): boolean {
  return isBrowser() && !!localStorage.getItem(LS_KEY);
}

export async function setApiKey(rawKey: string, remember: boolean): Promise<void> {
  const key = rawKey.trim();
  if (!isBrowser() || !key) return;
  if (remember) {
    const wrapKey = await getOrCreateWrapKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, new TextEncoder().encode(key));
    localStorage.setItem(LS_KEY, JSON.stringify({ iv: toB64(iv.buffer), ct: toB64(ct) }));
    sessionKey = null;
  } else {
    sessionKey = key;
    localStorage.removeItem(LS_KEY);
  }
}

export async function getApiKey(): Promise<string | null> {
  if (sessionKey) return sessionKey;
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
    const wrapKey = await getOrCreateWrapKey();
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, wrapKey, fromB64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export function clearApiKey(): void {
  sessionKey = null;
  if (isBrowser()) localStorage.removeItem(LS_KEY);
}

let serverPubKey: CryptoKey | null = null;

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return fromB64(b64);
}

async function getServerPublicKey(force = false): Promise<CryptoKey> {
  if (serverPubKey && !force) return serverPubKey;
  const res = await fetch('/api/byok/pubkey', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not fetch encryption key');
  const { publicKey } = (await res.json()) as { publicKey: string };
  serverPubKey = await crypto.subtle.importKey(
    'spki',
    pemToDer(publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  return serverPubKey;
}

export async function getEncryptedKeyForRequest(refresh = false): Promise<string | null> {
  if (!isBrowser()) return null;
  const raw = await getApiKey();
  if (!raw) return null;
  const pub = await getServerPublicKey(refresh);
  const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new TextEncoder().encode(raw));
  return toB64(ct);
}
