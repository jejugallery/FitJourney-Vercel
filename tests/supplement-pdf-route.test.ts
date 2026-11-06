import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('external supplement PDF and dashboard routes are outside LIFF provider', () => {
  assert.match(app, /<Route path="\/supplement-course-pdf" element={<SupplementCoursePdfPage \/>} \/>/);
  assert.match(app, /<Route path="\/supplement-course-dashboard" element={<SupplementCourseDashboardPage \/>} \/>/);
  assert.match(app, /<Route path="\*" element={<AuthenticatedRoutes \/>} \/>/);
});
