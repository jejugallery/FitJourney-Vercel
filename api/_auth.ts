import type { VercelRequest } from '@vercel/node';

const PROJECT_ID = 'fitjourneythailand';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type FirestoreValue = { stringValue?: string; arrayValue?: { values?: FirestoreValue[] } };
type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue> };

export interface AuthenticatedTrainer {
  userId: string;
  displayName: string;
  status: string;
  isSuperadmin: boolean;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function stringField(doc: FirestoreDocument, field: string) {
  return doc.fields?.[field]?.stringValue || '';
}

function stringArrayField(doc: FirestoreDocument, field: string) {
  return (doc.fields?.[field]?.arrayValue?.values || []).map(value => value.stringValue || '').filter(Boolean);
}

async function queryByString(collectionId: string, fieldPath: string, value: string): Promise<FirestoreDocument | null> {
  const response = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } },
        limit: 1,
      },
    }),
  });
  if (!response.ok) throw new HttpError(503, 'ไม่สามารถตรวจสอบสิทธิ์จากฐานข้อมูลได้');
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return rows.find(row => row.document)?.document || null;
}

async function lineProfile(req: VercelRequest): Promise<{ userId: string; displayName: string }> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ LINE ใหม่');

  const verify = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`);
  if (!verify.ok) throw new HttpError(401, 'เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่');

  const profile = await fetch('https://api.line.me/v2/profile', { headers: { Authorization: `Bearer ${token}` } });
  if (!profile.ok) throw new HttpError(401, 'ไม่สามารถยืนยันตัวตน LINE ได้');
  const data = await profile.json() as { userId?: string; displayName?: string };
  if (!data.userId) throw new HttpError(401, 'ไม่พบผู้ใช้งาน LINE');
  return { userId: data.userId, displayName: data.displayName || 'เทรนเนอร์' };
}

export async function requireTrainer(req: VercelRequest): Promise<AuthenticatedTrainer> {
  const profile = await lineProfile(req);
  const trainer = await queryByString('trainers', 'trainerId', profile.userId);
  if (!trainer) throw new HttpError(403, 'บัญชีนี้ไม่ใช่เทรนเนอร์');
  const status = stringField(trainer, 'status');
  if (status !== 'อนุมัติ' && status !== 'superadmin') throw new HttpError(403, 'บัญชีเทรนเนอร์ยังไม่ได้รับอนุมัติ');
  return {
    userId: profile.userId,
    displayName: stringField(trainer, 'nickname') || stringField(trainer, 'displayName') || profile.displayName,
    status,
    isSuperadmin: status === 'superadmin',
  };
}

export async function requireSuperadmin(req: VercelRequest) {
  const trainer = await requireTrainer(req);
  if (!trainer.isSuperadmin) throw new HttpError(403, 'สงวนสิทธิ์สำหรับ superadmin');
  return trainer;
}

export async function requireLinkedTrainee(actorId: string, traineeId: string) {
  const trainee = await queryByString('trainees', 'userId', traineeId);
  if (!trainee || !stringArrayField(trainee, 'trainerIds').includes(actorId)) {
    throw new HttpError(403, 'คุณไม่มีสิทธิ์จัดคอร์สให้ลูกเทรนรายนี้');
  }
  return {
    userId: traineeId,
    nickname: stringField(trainee, 'nickname') || stringField(trainee, 'lineName') || 'ลูกเทรน',
  };
}
