import assert from 'node:assert/strict';
import test from 'node:test';
import { CASHBACK_PERCENTAGES, calculateCashback, calculateCourseLine } from '../src/features/supplements/pricing.ts';

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

test('cashback is calculated from final net total without changing that total', () => {
  const total = 2900;
  assert.equal(calculateCashback(total, 6), 174);
  assert.equal(total, 2900);
});

test('cashback rounds to two decimal places', () => {
  assert.equal(calculateCashback(999.99, 3), 30);
  assert.equal(calculateCashback(1234.56, 21), 259.26);
});

test('cashback exposes exactly the approved percentage options', () => {
  assert.deepEqual([...CASHBACK_PERCENTAGES], [3, 6, 9, 12, 15, 18, 21]);
});

test('a free item stays free even when a discount is selected', () => {
  assert.deepEqual(calculateCourseLine(0, 2, 'custom', 500), {
    grossAmount: 0,
    discountAmount: 0,
    netAmount: 0,
  });
});
