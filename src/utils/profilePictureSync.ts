import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { LineProfile } from '../context/LiffContext';
import { uploadImageUrlToImgBB } from './mediaHelper';
import { needsProfilePictureSync } from './profilePicturePolicy';

export async function syncLineProfilePicture(profile: LineProfile): Promise<void> {
  const linePictureUrl = profile.pictureUrl?.trim();
  if (!linePictureUrl || !profile.userId.startsWith('U')) return;

  const [trainerSnapshot, traineeSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'trainers'), where('trainerId', '==', profile.userId))),
    getDocs(query(collection(db, 'trainees'), where('userId', '==', profile.userId))),
  ]);
  const documents = [...trainerSnapshot.docs, ...traineeSnapshot.docs];
  const targets = documents.filter(snapshot => needsProfilePictureSync(snapshot.data(), linePictureUrl));
  if (!targets.length) return;

  let pictureBackupUrl = targets.find(snapshot => snapshot.data().pictureBackupSourceUrl === linePictureUrl)?.data().pictureBackupUrl || '';
  let backupPending = false;
  if (!pictureBackupUrl) {
    try {
      pictureBackupUrl = await uploadImageUrlToImgBB(linePictureUrl);
    } catch (error) {
      backupPending = true;
      console.warn('Profile picture backup failed; it will retry next login.', error);
    }
  }

  await Promise.all(targets.map(snapshot => updateDoc(doc(db, snapshot.ref.parent.id, snapshot.id), {
    pictureUrl: linePictureUrl,
    ...(pictureBackupUrl ? { pictureBackupUrl, pictureBackupSourceUrl: linePictureUrl } : {}),
    pictureBackupPending: backupPending,
    pictureSyncedAt: serverTimestamp(),
  })));
}
