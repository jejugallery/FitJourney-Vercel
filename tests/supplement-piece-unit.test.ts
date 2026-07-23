import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const types = read('../src/features/supplements/types.ts');
const catalog = read('../src/features/supplements/SupplementCatalogPanel.tsx');
const validation = read('../api/_supplement-validation.ts');
const runtimeSchema = read('../api/_supplement-schema.ts');
const databaseSchema = read('../schema.sql');

test('piece is available as a supplement content unit across every layer', () => {
  assert.match(types, /'ชิ้น'/);
  assert.match(catalog, /<option>ชิ้น<\/option>/);
  assert.match(validation, /'ชิ้น'/);
  assert.match(runtimeSchema, /'ชิ้น'/);
  assert.match(databaseSchema, /'ชิ้น'/);
});
