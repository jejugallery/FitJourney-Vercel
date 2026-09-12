import assert from 'node:assert/strict';
import test from 'node:test';

interface TraineePayload {
  traineeId: string;
  traineeName?: string;
  fallbackNickname: string;
}

function resolveTraineeName(payload: TraineePayload): string {
  const custom = (payload.traineeName || '').trim();
  return custom || payload.fallbackNickname;
}

test('uses custom traineeName if provided', () => {
  const name = resolveTraineeName({
    traineeId: 'trainee-123',
    traineeName: 'น้องเมย์ (คอร์ส 2 เดือน)',
    fallbackNickname: 'น้องเมย์',
  });
  assert.equal(name, 'น้องเมย์ (คอร์ส 2 เดือน)');
});

test('falls back to default trainee nickname if custom name is empty', () => {
  const name = resolveTraineeName({
    traineeId: 'trainee-123',
    traineeName: '   ',
    fallbackNickname: 'น้องเมย์',
  });
  assert.equal(name, 'น้องเมย์');
});
