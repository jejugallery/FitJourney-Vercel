import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { needsProfilePictureSync } from '../src/utils/profilePicturePolicy.ts';

test('syncs when LINE changed or the ImgBB backup is missing', () => {
  assert.equal(needsProfilePictureSync({ pictureUrl: 'line-old', pictureBackupUrl: 'imgbb-old' }, 'line-new'), true);
  assert.equal(needsProfilePictureSync({ pictureUrl: 'line-current' }, 'line-current'), true);
  assert.equal(needsProfilePictureSync({ pictureUrl: 'line-current', pictureBackupUrl: 'imgbb-old', pictureBackupPending: true }, 'line-current'), true);
  assert.equal(needsProfilePictureSync({ pictureUrl: 'line-current', pictureBackupUrl: 'imgbb-current', pictureBackupSourceUrl: 'line-current' }, 'line-current'), false);
});

test('client-side sync updates both profile collections without adding a serverless function', () => {
  const syncSource = readFileSync(new URL('../src/utils/profilePictureSync.ts', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../src/pages/Home.tsx', import.meta.url), 'utf8');
  assert.match(syncSource, /collection\(db, 'trainers'\)/);
  assert.match(syncSource, /collection\(db, 'trainees'\)/);
  assert.match(syncSource, /uploadImageUrlToImgBB/);
  assert.match(syncSource, /pictureBackupPending/);
  assert.match(homeSource, /syncLineProfilePicture/);
});

test('profile image tries its backup after its primary source fails', () => {
  const source = readFileSync(new URL('../src/components/ProfileImage.tsx', import.meta.url), 'utf8');
  assert.match(source, /fallbackSrc/);
  assert.match(source, /fallbackApplied/);
  assert.match(source, /image\.src = fallbackSrc/);
});
