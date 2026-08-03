export interface StoredProfilePicture {
  pictureUrl?: string;
  pictureBackupUrl?: string;
  pictureBackupSourceUrl?: string;
  pictureBackupPending?: boolean;
}

export function needsProfilePictureSync(stored: StoredProfilePicture, linePictureUrl: string): boolean {
  return Boolean(linePictureUrl) && (
    stored.pictureUrl !== linePictureUrl
    || !stored.pictureBackupUrl
    || stored.pictureBackupSourceUrl !== linePictureUrl
    || stored.pictureBackupPending === true
  );
}
