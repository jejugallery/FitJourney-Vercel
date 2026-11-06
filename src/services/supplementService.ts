import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateCourseCashback, calculateCourseLine } from '../features/supplements/pricing';
import type { DiscountType, Supplement, SavedSupplementCourse } from '../features/supplements/types';
import { isPdfTokenExpired, sha256Hex } from '../features/supplements/tokenUtils';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

async function getCurrentTrainerInfo(): Promise<{ userId: string; displayName: string }> {
  try {
    if (typeof window !== 'undefined' && (window as any).liff && (window as any).liff.isLoggedIn?.()) {
      const p = await (window as any).liff.getProfile();
      if (p?.userId) {
        return { userId: p.userId, displayName: p.displayName || 'Trainer' };
      }
    }
  } catch {
    // ignore
  }
  return { userId: 'trainer', displayName: 'Trainer' };
}

export const supplementService = {
  // --- Catalog ---
  async listSupplements(includeArchived = false): Promise<Supplement[]> {
    const col = collection(db, 'supplements');
    const snap = await getDocs(col);
    const list: Supplement[] = [];
    snap.forEach(d => {
      const data = d.data();
      if (includeArchived || data.isActive) {
        list.push({
          id: d.id,
          name: data.name,
          imageUrl: data.imageUrl,
          price: Number(data.price),
          contentQuantity: Number(data.contentQuantity),
          contentUnit: data.contentUnit,
          isActive: Boolean(data.isActive),
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  },

  async createSupplement(data: any): Promise<Supplement> {
    const id = generateId();
    const trainer = await getCurrentTrainerInfo();
    const now = new Date().toISOString();
    const docData: Supplement = {
      id,
      name: String(data.name || '').trim(),
      imageUrl: String(data.imageUrl || '').trim(),
      price: Number(data.price || 0),
      contentQuantity: Number(data.contentQuantity || 1),
      contentUnit: data.contentUnit || 'เม็ด',
      isActive: true,
      createdBy: trainer.userId,
      updatedBy: trainer.userId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'supplements', id), docData);
    return docData;
  },

  async updateSupplement(id: string, data: any): Promise<Supplement> {
    const ref = doc(db, 'supplements', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('ไม่พบอาหารเสริมที่ต้องการแก้ไข');
    const trainer = await getCurrentTrainerInfo();
    const updateData: Partial<Supplement> = {
      name: String(data.name || '').trim(),
      imageUrl: String(data.imageUrl || '').trim(),
      price: Number(data.price || 0),
      contentQuantity: Number(data.contentQuantity || 1),
      contentUnit: data.contentUnit || 'เม็ด',
      updatedBy: trainer.userId,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(ref, updateData);
    return { id, ...snap.data(), ...updateData } as Supplement;
  },

  async archiveSupplement(id: string): Promise<{ id: string; archived: boolean }> {
    const ref = doc(db, 'supplements', id);
    const trainer = await getCurrentTrainerInfo();
    await updateDoc(ref, {
      isActive: false,
      archivedBy: trainer.userId,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { id, archived: true };
  },

  // --- Courses ---
  async listCourses(traineeId?: string): Promise<SavedSupplementCourse[]> {
    const col = collection(db, 'supplementCourses');
    let q = query(col);
    if (traineeId) {
      q = query(col, where('traineeId', '==', traineeId));
    }
    const snap = await getDocs(q);
    const list: SavedSupplementCourse[] = [];
    snap.forEach(d => {
      const data = d.data() as SavedSupplementCourse;
      list.push({
        ...data,
        itemCount: data.items?.length || 0,
      } as any);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getCourse(id: string): Promise<SavedSupplementCourse> {
    const ref = doc(db, 'supplementCourses', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('ไม่พบประวัติคอร์ส');
    const data = snap.data() as SavedSupplementCourse;
    return {
      ...data,
      itemCount: data.items?.length || 0,
    } as any;
  },

  async saveCourse(courseData: any, existingId?: string): Promise<SavedSupplementCourse> {
    const id = existingId || generateId();
    const trainer = await getCurrentTrainerInfo();
    const now = new Date().toISOString();
    const cashbackPercent = Number(courseData.cashbackPercent || 0);

    // Load catalog to enrich item data
    const allSupplements = await this.listSupplements(true);
    const suppMap = new Map(allSupplements.map(s => [s.id, s]));

    const items = (courseData.items || []).map((line: any, idx: number) => {
      const supplementId = String(line.supplementId || line.supplement?.id || '');
      const supp = suppMap.get(supplementId);
      const unitPrice = supp ? supp.price : Number(line.unitPrice || line.supplement?.price || 0);
      const packageQuantity = Number(line.packageQuantity || 1);
      const discountType = (line.discountType || 'none') as DiscountType;
      const discountValue = Number(line.discountValue || 0);
      const priced = calculateCourseLine(unitPrice, packageQuantity, discountType, discountValue);

      return {
        id: line.id || generateId(),
        supplementId,
        supplementName: supp?.name || line.supplementName || line.supplement?.name || 'อาหารเสริม',
        imageUrl: supp?.imageUrl || line.imageUrl || line.supplement?.imageUrl || '',
        contentQuantity: supp ? supp.contentQuantity : Number(line.contentQuantity || line.supplement?.contentQuantity || 1),
        contentUnit: supp ? supp.contentUnit : (line.contentUnit || line.supplement?.contentUnit || 'เม็ด'),
        unitPrice,
        packageQuantity,
        discountType,
        discountValue,
        grossAmount: priced.grossAmount,
        discountAmount: priced.discountAmount,
        netAmount: priced.netAmount,
        sortOrder: idx,
      };
    });

    const subtotal = Math.round(items.reduce((s: number, i: any) => s + i.grossAmount, 0) * 100) / 100;
    const discountTotal = Math.round(items.reduce((s: number, i: any) => s + i.discountAmount, 0) * 100) / 100;
    const total = Math.round(items.reduce((s: number, i: any) => s + i.netAmount, 0) * 100) / 100;
    const cashbackAmount = calculateCourseCashback(items.map((i: any) => ({ name: i.supplementName, netAmount: i.netAmount })), cashbackPercent);

    // Resolve trainee name if needed
    let traineeName = String(courseData.traineeName || '').trim();
    const traineeId = String(courseData.traineeId || '');
    if (!traineeName && traineeId) {
      try {
        const traineeQuerySnap = await getDocs(query(collection(db, 'trainees'), where('userId', '==', traineeId)));
        if (!traineeQuerySnap.empty) {
          const tDoc = traineeQuerySnap.docs[0].data();
          traineeName = tDoc.nickname || tDoc.displayName || tDoc.name || traineeId;
        }
      } catch {
        // ignore
      }
    }

    const courseDoc: SavedSupplementCourse = {
      id,
      trainerId: courseData.trainerId || trainer.userId,
      trainerName: courseData.trainerName || trainer.displayName,
      traineeId,
      traineeName: traineeName || traineeId,
      subtotal,
      discountTotal,
      total,
      cashbackPercent,
      cashbackAmount,
      items,
      createdAt: courseData.createdAt || now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'supplementCourses', id), courseDoc);
    return courseDoc;
  },

  async deleteCourse(id: string): Promise<{ id: string; deleted: boolean }> {
    const ref = doc(db, 'supplementCourses', id);
    await deleteDoc(ref);
    return { id, deleted: true };
  },

  // --- PDF Tokens ---
  async createPdfToken(courseId: string): Promise<{ token: string; expiresAt: string }> {
    const rawBytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(rawBytes);
    } else {
      for (let i = 0; i < 32; i++) rawBytes[i] = Math.floor(Math.random() * 256);
    }
    const rawToken = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await setDoc(doc(db, 'supplementCoursePdfTokens', tokenHash), {
      tokenHash,
      courseId,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return { token: rawToken, expiresAt };
  },

  async getByPdfToken(token: string): Promise<SavedSupplementCourse> {
    const tokenHash = await sha256Hex(token);
    const tokenSnap = await getDoc(doc(db, 'supplementCoursePdfTokens', tokenHash));
    if (!tokenSnap.exists()) {
      throw new Error('ลิงก์ดาวน์โหลดไม่ถูกต้องหรือหมดอายุแล้ว');
    }
    const tokenData = tokenSnap.data();
    if (isPdfTokenExpired(tokenData.expiresAt)) {
      throw new Error('ลิงก์ดาวน์โหลดหมดอายุแล้ว');
    }
    return this.getCourse(tokenData.courseId);
  }
};
