import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getLinkedTraineeIds } from '../api/_linked-trainees.ts';

const courseApi = readFileSync(new URL('../api/supplement-courses.ts', import.meta.url), 'utf8');

test('resolves unique trainee IDs through trainerIds ARRAY_CONTAINS', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify([
      { document: { name: 'trainees/1', fields: { userId: { stringValue: 'trainee-a' } } } },
      { document: { name: 'trainees/2', fields: { userId: { stringValue: 'trainee-b' } } } },
      { document: { name: 'trainees/3', fields: { userId: { stringValue: 'trainee-a' } } } },
      { document: { name: 'trainees/4', fields: {} } },
    ]), { status: 200 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await getLinkedTraineeIds('trainer-1'), ['trainee-a', 'trainee-b']);
    const filter = requestBody.structuredQuery.where.fieldFilter;
    assert.equal(filter.field.fieldPath, 'trainerIds');
    assert.equal(filter.op, 'ARRAY_CONTAINS');
    assert.equal(filter.value.stringValue, 'trainer-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('course list and details authorize through linked trainee IDs', () => {
  assert.match(courseApi, /getLinkedTraineeIds\(actor\.userId\)/);
  assert.match(courseApi, /SELECT \* FROM supplement_courses WHERE id = \$\{id\}/);
  assert.match(courseApi, /requireLinkedTrainee\(actor\.userId, rows\[0\]\.trainee_id\)/);
});

test('PDF token issuance authorizes the course trainee instead of its creator', () => {
  assert.match(courseApi, /requireLinkedTrainee\(actor\.userId, courses\[0\]\.trainee_id\)/);
  assert.doesNotMatch(courseApi, /WHERE id = \$\{courseId\} AND trainer_id = \$\{actor\.userId\}/);
});
