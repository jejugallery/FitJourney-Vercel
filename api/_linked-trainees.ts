const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/fitjourneythailand/databases/(default)/documents';

type FirestoreDocument = { fields?: Record<string, { stringValue?: string }> };

export async function getLinkedTraineeIds(actorId: string): Promise<string[]> {
  const response = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'trainees' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'trainerIds' },
            op: 'ARRAY_CONTAINS',
            value: { stringValue: actorId },
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error('ไม่สามารถโหลดรายชื่อลูกเทรนที่เชื่อมต่อได้');
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return [...new Set(rows.map(row => row.document?.fields?.userId?.stringValue || '').filter(Boolean))];
}
