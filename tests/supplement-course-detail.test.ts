import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatCourseItemPriceQuantity } from '../src/features/supplements/courseDetailDisplay.ts';

test('formats paid and free course item quantities', () => {
  assert.equal(formatCourseItemPriceQuantity(1000, 2), '฿1,000.00 × 2');
  assert.equal(formatCourseItemPriceQuantity(0, 1), 'ฟรี × 1');
});

test('course detail displays item total before discount, discount, and net price in right price block', () => {
  const component = readFileSync(new URL('../src/features/supplements/SupplementCourseHistory.tsx', import.meta.url), 'utf8');
  assert.match(component, /formatCourseItemUnitPrice\(item\.unitPrice\)/);
  assert.match(component, /supplement-item-qty/);
  assert.match(component, /supplement-snapshot-price/);
  assert.match(component, /฿\{money\(grossAmount\)\}/);
  assert.match(component, /ส่วนลด -฿\{money\(item\.discountAmount\)\}/);
  assert.match(component, /฿\{money\(item\.netAmount\)\}/);
  assert.match(component, /supplement-snapshot-img/);
  assert.doesNotMatch(component, /\{item\.contentQuantity\} \{item\.contentUnit\}/);
  assert.doesNotMatch(component, /รวมก่อนลด/);
  assert.doesNotMatch(component, /สุทธิ ฿/);
  assert.doesNotMatch(component, /จำนวน \{item\.packageQuantity\}/);
});

