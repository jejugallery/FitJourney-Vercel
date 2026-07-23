import assert from 'node:assert/strict';
import test from 'node:test';
import { createPdfToken, hashPdfToken, isPdfTokenExpired } from '../api/_supplement-pdf-token.ts';

test('creates a hashed PDF token that expires in exactly 15 minutes', () => {
  const now = new Date('2026-07-23T05:00:00.000Z');
  const token = createPdfToken(now);
  assert.match(token.rawToken, /^[a-f0-9]{64}$/);
  assert.equal(token.tokenHash, hashPdfToken(token.rawToken));
  assert.equal(token.expiresAt.toISOString(), '2026-07-23T05:15:00.000Z');
  assert.notEqual(token.rawToken, token.tokenHash);
});

test('treats the exact expiration instant as expired', () => {
  const expiresAt = '2026-07-23T05:15:00.000Z';
  assert.equal(isPdfTokenExpired(expiresAt, new Date('2026-07-23T05:14:59.999Z')), false);
  assert.equal(isPdfTokenExpired(expiresAt, new Date('2026-07-23T05:15:00.000Z')), true);
});
