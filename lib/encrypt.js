/**
 * AES-256-CBC encryption helpers for storing OAuth tokens at rest.
 * Used to encrypt access tokens before persisting them for scheduled switches.
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts `plaintext` and returns a string in the format "iv:ciphertext"
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string previously encrypted with `encrypt()`.
 */
export function decrypt(encoded) {
  const key = getKey();
  const [ivHex, cipherHex] = encoded.split(':');
  if (!ivHex || !cipherHex) throw new Error('Invalid encrypted format.');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
