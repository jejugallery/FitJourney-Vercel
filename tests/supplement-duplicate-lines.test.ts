import assert from 'node:assert/strict';
import test from 'node:test';
import { countDraftLinesBySupplement, createCourseDraftLine } from '../src/features/supplements/draftLines.ts';
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

test('selected counts reflect every independent draft line', () => {
  const secondSupplement = { ...supplement, id: 'supplement-b', name: 'Protein B' };
  const lines = [
    createCourseDraftLine(supplement),
    createCourseDraftLine(secondSupplement),
    createCourseDraftLine(supplement),
  ];
  assert.deepEqual(countDraftLinesBySupplement(lines), {
    'supplement-a': 2,
    'supplement-b': 1,
  });
});
