import crypto, { type KeyObject } from 'crypto';
import { config } from '@/lib/config';

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

export function getPublicKeyPem(): string {
  return keys().publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

export function decryptApiKey(ciphertextB64: string): string {
  const plaintext = crypto.privateDecrypt(
    { key: keys().privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(ciphertextB64, 'base64')
  );
  return plaintext.toString('utf8');
}
