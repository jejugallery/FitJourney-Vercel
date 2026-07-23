import * as crypto from 'crypto';

const PDF_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

export function hashPdfToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createPdfToken(now = new Date()) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return {
    rawToken,
    tokenHash: hashPdfToken(rawToken),
    expiresAt: new Date(now.getTime() + PDF_TOKEN_LIFETIME_MS),
  };
}

export function isPdfTokenExpired(expiresAt: Date | string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
