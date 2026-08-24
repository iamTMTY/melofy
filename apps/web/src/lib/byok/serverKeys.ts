import crypto, { type KeyObject } from 'crypto';
import { config } from '@/lib/config';

// Server side of "bring your own key": an RSA keypair whose PUBLIC half the
// client fetches to encrypt the user's API key (RSA-OAEP). Only this process,
// holding the private half, can decrypt it — and it does so in memory, per
// request, never persisting or logging the plaintext key.
//
// Key source: BYOK_PRIVATE_KEY (PEM) in prod so the published public key is
// stable across restarts/instances; otherwise an ephemeral keypair per process
// (fine for single-instance dev — if the server restarts, the client simply
// refetches the public key and retries).

// Stored on `global` (like the Redis client) so the SAME keypair is shared across
// every API route and survives Next.js dev module re-evaluation/HMR — otherwise
// the pubkey route and the translate route could hold DIFFERENT ephemeral keys
// and decryption would fail.
declare global {
  var _byokKeys: { publicKey: KeyObject; privateKey: KeyObject } | undefined;
}

function keys(): { publicKey: KeyObject; privateKey: KeyObject } {
  if (!global._byokKeys) {
    if (config.byokPrivateKey) {
      const privateKey = crypto.createPrivateKey(config.byokPrivateKey);
      global._byokKeys = { privateKey, publicKey: crypto.createPublicKey(privateKey) };
    } else {
      const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      global._byokKeys = { publicKey: kp.publicKey, privateKey: kp.privateKey };
    }
  }
  return global._byokKeys;
}

/** SPKI PEM the client imports to encrypt with RSA-OAEP (SHA-256). */
export function getPublicKeyPem(): string {
  return keys().publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

/** Decrypt a base64 RSA-OAEP(SHA-256) ciphertext back to the plaintext API key. */
export function decryptApiKey(ciphertextB64: string): string {
  const plaintext = crypto.privateDecrypt(
    { key: keys().privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(ciphertextB64, 'base64')
  );
  return plaintext.toString('utf8');
}
