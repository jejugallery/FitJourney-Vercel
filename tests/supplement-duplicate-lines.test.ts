import assert from 'node:assert/strict';
import test from 'node:test';
import { createCourseDraftLine } from '../src/features/supplements/draftLines.ts';
import { getUniqueSupplementIds } from '../api/_supplement-course-lines.ts';

const supplement = {
  id: 'supplement-a', name: 'Protein A', imageUrl: 'https://example.com/a.png',
  price: 1000, contentQuantity: 30, contentUnit: 'ซอง' as const, isActive: true,
};

test('selecting the same supplement twice creates independent line identities', () => {
  const first = createCourseDraftLine(supplement);
  const second = createCourseDraftLine(supplement);
  assert.equal(first.supplementId, second.supplementId);
  assert.notEqual(first.lineId, second.lineId);
});

test('duplicate submitted lines use one catalog lookup ID without rejecting rows', () => {
  const submitted = [{ supplementId: 'supplement-a' }, { supplementId: 'supplement-a' }];
  assert.deepEqual(getUniqueSupplementIds(submitted), ['supplement-a']);
  assert.equal(submitted.length, 2);
});
