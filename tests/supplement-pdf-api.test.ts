import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const api = readFileSync(new URL('../api/supplement-courses.ts', import.meta.url), 'utf8');

test('public PDF token lookup happens before trainer authentication', () => {
  const lookup = api.indexOf("req.query.pdfToken");
  const authentication = api.indexOf('requireTrainer(req)');
  assert.ok(lookup >= 0);
  assert.ok(authentication >= 0);
  assert.ok(lookup < authentication);
  assert.match(api, /Cache-Control', 'no-store/);
});

test('PDF token creation verifies trainer course ownership', () => {
  assert.match(api, /action === 'pdf-token'/);
  assert.match(api, /trainer_id = \$\{actor\.userId\}/);
  assert.match(api, /supplement_course_pdf_tokens/);
});
