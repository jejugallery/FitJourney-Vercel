import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSupplementInput } from '../api/_supplement-validation.ts';

const validBody = (patch: Record<string, unknown> = {}) => ({
  name: 'Vitamin C',
  imageUrl: 'https://example.com/vitamin-c.png',
  price: 100,
  contentQuantity: 30,
  contentUnit: 'เม็ด',
  ...patch,
});

test('accepts a zero price as a free supplement', () => {
  assert.equal(parseSupplementInput(validBody({ price: 0 })).price, 0);
});

test('rejects negative and missing prices', () => {
  assert.throws(() => parseSupplementInput(validBody({ price: -1 })));
  assert.throws(() => parseSupplementInput(validBody({ price: '' })));
});
