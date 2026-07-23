import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCourseTrainees } from '../src/features/supplements/traineeSearch.ts';

const trainees = [
  { userId: '1', nickname: 'Vivian87' },
  { userId: '2', nickname: 'สมชาย Fit' },
];

test('empty search returns every linked trainee', () => {
  assert.deepEqual(filterCourseTrainees(trainees, ''), trainees);
});

test('nickname search is case insensitive and trims whitespace', () => {
  assert.deepEqual(filterCourseTrainees(trainees, '  VIVIAN  '), [trainees[0]]);
  assert.deepEqual(filterCourseTrainees(trainees, 'fit'), [trainees[1]]);
});
