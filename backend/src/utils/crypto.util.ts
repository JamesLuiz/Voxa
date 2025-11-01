import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

export function encryptText(plainText: string, key: string): string {
  if (!key || key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'utf8').slice(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Return iv:auth:encrypted in base64
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptText(encryptedText: string, key: string): string {
  if (!key || key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long');
  }
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const data = Buffer.from(parts[2], 'base64');

  const decipher = createDecipheriv(ALGORITHM, Buffer.from(key, 'utf8').slice(0, 32), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
