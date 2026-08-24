import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { getPublicKeyPem, decryptApiKey } from './serverKeys';

// The BYOK transit-encryption contract: a client encrypts the user's key with the
// server's published public key (RSA-OAEP, SHA-256); only the server can decrypt.
// This drives the exact roundtrip with Node's crypto standing in for the browser.
describe('BYOK transit crypto (RSA-OAEP SHA-256)', () => {
  it('publishes an SPKI public key PEM', () => {
    expect(getPublicKeyPem()).toContain('BEGIN PUBLIC KEY');
  });

  it('round-trips: encrypt with the public key → decryptApiKey recovers the plaintext', () => {
    const pem = getPublicKeyPem();
    const secret = 'sk-or-v1-super-secret-byok-key-1234567890';
    const ciphertext = crypto.publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(secret, 'utf8')
    );
    expect(decryptApiKey(ciphertext.toString('base64'))).toBe(secret);
  });

  it('fails to decrypt garbage rather than returning it', () => {
    expect(() => decryptApiKey(Buffer.from('not-a-real-ciphertext').toString('base64'))).toThrow();
  });
});
