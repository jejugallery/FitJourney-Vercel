import assert from 'node:assert/strict';
import test from 'node:test';
import { displayProductPrice } from '../src/features/supplements/priceDisplay.ts';

test('displays a zero product price as free', () => {
  assert.equal(displayProductPrice(0), 'ฟรี');
});

test('displays a paid product price in baht', () => {
  assert.equal(displayProductPrice(1250), '฿1,250.00');
});
