import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const form = read('../src/features/supplements/SupplementCourseForm.tsx');
const modal = read('../src/components/SupplementCourseModal.tsx');
const history = read('../src/features/supplements/SupplementCourseHistory.tsx');

test('course form saves without offering an immediate PDF download', () => {
  assert.match(form, /saving \? 'กำลังบันทึก\.\.\.' : 'บันทึก'/);
  assert.doesNotMatch(form, /บันทึกและดาวน์โหลด PDF/);
  assert.doesNotMatch(modal, /downloadSupplementCoursePdf/);
});

test('course history opens the external PDF flow', () => {
  assert.match(history, /openCoursePdfExternal/);
  assert.doesNotMatch(history, /downloadSupplementCoursePdf/);
});
