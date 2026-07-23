import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('course API permanently deletes only a course owned by the current trainer', () => {
  const source = read('../api/supplement-courses.ts');
  assert.match(source, /GET, POST, DELETE, OPTIONS/);
  assert.match(source, /req\.method === 'DELETE'/);
  assert.match(source, /DELETE FROM supplement_courses WHERE id = \$\{id\} AND trainer_id = \$\{actor\.userId\} RETURNING id/);
  assert.match(source, /ไม่พบคอร์สที่คุณสร้าง/);
});

test('client exposes delete and passes the current trainer to course history', () => {
  const api = read('../src/utils/api.ts');
  const metrics = read('../src/components/MetricsForm.tsx');
  const modal = read('../src/components/SupplementCourseModal.tsx');
  assert.match(api, /delete: \(id: string\).*method: 'DELETE'/);
  assert.match(metrics, /currentTrainerId=\{profile\?\.userId \|\| ''\}/);
  assert.match(modal, /currentTrainerId/);
  assert.match(modal, /<SupplementCourseHistory[^>]*currentTrainerId=\{currentTrainerId\}/);
});

test('history shows permanent delete only to the course creator and refreshes after deletion', () => {
  const source = read('../src/features/supplements/SupplementCourseHistory.tsx');
  assert.match(source, /active\.trainerId === currentTrainerId/);
  assert.match(source, /ลบประวัติคอร์ส/);
  assert.match(source, /supplementCoursesApi\.delete\(active\.id\)/);
  assert.match(source, /setActive\(null\)/);
  assert.match(source, /setLocalRefreshKey/);
  assert.match(source, /กู้คืนไม่ได้/);
});
