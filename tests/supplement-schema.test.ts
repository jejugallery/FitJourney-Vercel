import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtimeSchema = readFileSync(new URL('../api/_supplement-schema.ts', import.meta.url), 'utf8');
const databaseSchema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

test('supplement price constraints allow zero in new databases', () => {
  assert.match(runtimeSchema, /CHECK \(price >= 0\)/);
  assert.match(databaseSchema, /CHECK \(price >= 0\)/);
});

test('runtime migration replaces both legacy price constraint names', () => {
  assert.match(runtimeSchema, /DROP CONSTRAINT IF EXISTS supplements_preice_check/);
  assert.match(runtimeSchema, /DROP CONSTRAINT IF EXISTS supplements_price_check/);
  assert.match(runtimeSchema, /ADD CONSTRAINT supplements_price_check CHECK \(price >= 0\)/);
});
