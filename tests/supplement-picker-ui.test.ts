import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../src/features/supplements/SupplementCourseForm.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('picker stays open for repeated additions and shows selected counts', () => {
  assert.match(component, /เสร็จสิ้น/);
  assert.match(component, /เลือกแล้ว ×/);
  const addBody = component.match(/const add = \(supplement: Supplement\) => \{([\s\S]*?)\n  \};/)?.[1] || '';
  assert.doesNotMatch(addBody, /setPickerOpen\(false\)/);
});

test('selected cards use compact responsive controls', () => {
  assert.match(component, /supplement-course-card-compact/);
  assert.match(component, /supplement-course-controls/);
  assert.match(styles, /\.supplement-course-controls/);
  assert.match(styles, /@media \(max-width: 360px\)/);
});
