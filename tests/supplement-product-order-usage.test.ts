import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('catalog and course form use shared product ordering', () => {
  const catalog = read('../src/features/supplements/SupplementCatalogPanel.tsx');
  const form = read('../src/features/supplements/SupplementCourseForm.tsx');
  assert.match(catalog, /orderSupplementProducts/);
  assert.match(form, /orderSupplementProducts/);
  assert.match(form, /orderedLines/);
});

test('saved course detail and PDF use shared product ordering', () => {
  const history = read('../src/features/supplements/SupplementCourseHistory.tsx');
  const pdf = read('../src/features/supplements/coursePdf.ts');
  assert.match(history, /orderSupplementProducts/);
  assert.match(pdf, /orderSupplementProducts/);
  assert.doesNotMatch(pdf, /pdfItemOrder/);
});
