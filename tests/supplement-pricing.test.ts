import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCourseLine } from '../src/features/supplements/pricing.ts';

test('percentage discount applies to one unit when quantity is greater than one', () => {
  assert.deepEqual(calculateCourseLine(1000, 3, 'percent_10'), {
    grossAmount: 3000,
    discountAmount: 100,
    netAmount: 2900,
  });
  assert.deepEqual(calculateCourseLine(1000, 3, 'percent_15'), {
    grossAmount: 3000,
    discountAmount: 150,
    netAmount: 2850,
  });
});

test('fixed and custom discounts apply to one unit only', () => {
  assert.equal(calculateCourseLine(1000, 3, 'fixed_100').netAmount, 2900);
  assert.equal(calculateCourseLine(1000, 3, 'fixed_500').netAmount, 2500);
  assert.equal(calculateCourseLine(1000, 3, 'custom', 750).netAmount, 2250);
  assert.equal(calculateCourseLine(1000, 3, 'custom', 1500).netAmount, 2000);
});
