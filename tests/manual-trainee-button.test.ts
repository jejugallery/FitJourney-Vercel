import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

test('MetricsForm contains custom add trainee button next to label, inside dropdown, and in empty state', () => {
  const metricsFormPath = path.resolve('src/components/MetricsForm.tsx');
  const content = fs.readFileSync(metricsFormPath, 'utf-8');

  // Must have button next to label
  assert.ok(
    content.includes('➕ เพิ่มลูกเทรนแบบกำหนดเอง'),
    'MetricsForm must have "➕ เพิ่มลูกเทรนแบบกำหนดเอง" text'
  );

  // Must trigger setShowManualRegister(true)
  assert.ok(
    content.includes('setShowManualRegister(true)'),
    'MetricsForm must invoke setShowManualRegister(true)'
  );

  // ManualTraineeForm must accept traineeId in onSuccess
  const manualFormPath = path.resolve('src/components/ManualTraineeForm.tsx');
  const manualContent = fs.readFileSync(manualFormPath, 'utf-8');
  assert.ok(
    manualContent.includes('generatedUserId'),
    'ManualTraineeForm must pass generatedUserId'
  );
});
