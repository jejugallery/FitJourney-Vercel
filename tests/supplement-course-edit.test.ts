import assert from 'node:assert/strict';
import test from 'node:test';
import { draftLineFromSavedItem } from '../src/features/supplements/draftLines.ts';
import type { SavedSupplementCourseItem, Supplement } from '../src/features/supplements/types.ts';

test('converts saved supplement item to draft line for editing', () => {
  const supplements: Supplement[] = [
    { id: 'supp-1', name: 'Whey Protein', brand: 'Optimum', category: 'Protein', price: 1500, contentQuantity: 1000, contentUnit: 'กรัม', description: '', isActive: true, sortOrder: 0, createdAt: 1, updatedAt: 1 },
    { id: 'supp-2', name: 'Fish Oil', brand: 'Blackmores', category: 'Health', price: 500, contentQuantity: 60, contentUnit: 'แคปซูล', description: '', isActive: true, sortOrder: 1, createdAt: 1, updatedAt: 1 },
  ];

  const savedItem: SavedSupplementCourseItem = {
    id: 'item-1',
    supplementId: 'supp-1',
    supplementName: 'Whey Protein',
    unitPrice: 1500,
    packageQuantity: 2,
    discountType: 'percent_10',
    discountValue: 10,
    grossAmount: 3000,
    discountAmount: 300,
    netAmount: 2700,
  };

  const line = draftLineFromSavedItem(savedItem, supplements);

  assert.equal(line.supplementId, 'supp-1');
  assert.equal(line.packageQuantity, 2);
  assert.equal(line.discountType, 'percent_10');
  assert.equal(line.discountValue, 10);
  assert.equal(line.supplement.name, 'Whey Protein');
  assert.equal(line.supplement.price, 1500);
});

test('handles archived or missing supplement in draftLineFromSavedItem gracefully', () => {
  const supplements: Supplement[] = [];

  const savedItem: SavedSupplementCourseItem = {
    id: 'item-2',
    supplementId: 'supp-archived',
    supplementName: 'Old Supplement',
    unitPrice: 800,
    packageQuantity: 1,
    discountType: 'none',
    discountValue: 0,
    grossAmount: 800,
    discountAmount: 0,
    netAmount: 800,
    imageUrl: 'https://example.com/old.jpg',
  };

  const line = draftLineFromSavedItem(savedItem, supplements);

  assert.equal(line.supplementId, 'supp-archived');
  assert.equal(line.packageQuantity, 1);
  assert.equal(line.supplement.name, 'Old Supplement');
  assert.equal(line.supplement.price, 800);
  assert.equal(line.supplement.imageUrl, 'https://example.com/old.jpg');
});
