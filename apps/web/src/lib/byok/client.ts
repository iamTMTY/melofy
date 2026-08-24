// Client side of "bring your own key".
//
// At rest ("remember on this device"): the key is encrypted with AES-GCM using a
//   NON-EXTRACTABLE CryptoKey kept in IndexedDB, and the ciphertext lives in
//   localStorage. A snoop in DevTools sees ciphertext, not the key. (This does
//   NOT defend against XSS — nothing client-side can — only passive reads.)
// Session-only ("don't remember"): the key stays in memory and is gone on reload.
// In transit: the key is RSA-OAEP-encrypted for the server's public key before it
//   ever leaves the browser (belt-and-suspenders over HTTPS; keeps it out of logs).
// The plaintext key is NEVER sent to, or stored by, the server.

const LS_KEY = 'melofy-byok'; // localStorage: { iv, ct } when "remembered"
const IDB_NAME = 'melofy-byok';
const IDB_STORE = 'keys';
const WRAP_ID = 'wrap';

const isBrowser = () => typeof window !== 'undefined' && !!window.crypto?.subtle;

// In-memory key for the "don't remember" case (cleared on reload/tab close).
let sessionKey: string | null = null;

// --- base64 helpers ---------------------------------------------------------
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length); // ArrayBuffer-backed (satisfies BufferSource)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// --- at-rest wrap key (AES-GCM, non-extractable, in IndexedDB) --------------
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

// --- public API -------------------------------------------------------------

/** True if a key is available (session or remembered) — no decryption needed. */
export function hasApiKey(): boolean {
  if (sessionKey) return true;
  return isBrowser() && !!localStorage.getItem(LS_KEY);
}

/** Whether the stored key persists across reloads (remembered) vs session-only. */
export function isRemembered(): boolean {
  return isBrowser() && !!localStorage.getItem(LS_KEY);
}

/** Store the user's key. `remember` → encrypted at rest; otherwise in memory only. */
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

/** Retrieve the plaintext key (decrypting the at-rest copy if needed), or null. */
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

/** Forget the key (both session and remembered copies). */
export function clearApiKey(): void {
  sessionKey = null;
  if (isBrowser()) localStorage.removeItem(LS_KEY);
}

// --- in-transit encryption (RSA-OAEP for the server's public key) -----------
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

/**
 * The encrypted key to attach to a translate request, or null if the user has no
 * BYOK key set. `refresh` re-fetches the server public key (used to retry once
 * after a BYOK_DECRYPT_FAILED, e.g. the server rotated its ephemeral keypair).
 */
export async function getEncryptedKeyForRequest(refresh = false): Promise<string | null> {
  if (!isBrowser()) return null;
  const raw = await getApiKey();
  if (!raw) return null;
  const pub = await getServerPublicKey(refresh);
  const ct = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new TextEncoder().encode(raw));
  return toB64(ct);
}
