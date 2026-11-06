import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256Hex, isPdfTokenExpired } from '../src/features/supplements/tokenUtils.ts';

test('tokenUtils hashes token using sha256', async () => {
  const hash = await sha256Hex('test-token-123');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
});

test('tokenUtils detects expired token correctly', () => {
  const expiredDate = new Date(Date.now() - 1000).toISOString();
  const futureDate = new Date(Date.now() + 60000).toISOString();
  assert.equal(isPdfTokenExpired(expiredDate), true);
  assert.equal(isPdfTokenExpired(futureDate), false);
});
