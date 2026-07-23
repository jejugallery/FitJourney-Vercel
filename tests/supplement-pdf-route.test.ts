import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('external supplement PDF route is outside LIFF provider', () => {
  assert.match(app, /<Router><Routes>\s*<Route path="\/supplement-course-pdf" element={<SupplementCoursePdfPage \/>} \/>\s*<Route path="\*" element={<AuthenticatedRoutes \/>} \/>/);
});
