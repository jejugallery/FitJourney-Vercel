# Supplement System Firestore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Supplement catalog and course management system from Neon PostgreSQL to Google Cloud Firestore, migrate all 45 existing supplements and 11 courses, and update the client-side API layer.

**Architecture:** Implement a dedicated Firestore service layer (`src/services/supplementService.ts`) using the Firebase Web SDK (`firebase/firestore`). Embed course items directly in course documents (`items: [...]`) to simplify data fetching. Delegate Firestore security rules updates to the mandatory `firestore-rules-author` subagent. Migrate existing Neon PostgreSQL rows to Firestore collections via an executable migration script.

**Tech Stack:** React 19, TypeScript, Firebase Client SDK (`firebase/firestore`), `@neondatabase/serverless` (for migration), Node.js test runner (`node:test`).

## Global Constraints
- Target collections: `supplements`, `supplementCourses`, `supplementCoursePdfTokens`.
- Preserve existing supplement and course IDs during migration so external references remain intact.
- Allow zero price for free supplements and member applications (`price >= 0`).
- Ensure PDF tokens expire after 15 minutes and lookup uses SHA-256 hash.
- Changes to `firestore.rules` MUST be delegated to the `firestore-rules-author` subagent.

---

### Task 1: Update Firestore Security Rules

**Files:**
- Modify: `firestore.rules` (delegated via subagent `firestore-rules-author`)
- Test: `firestore.rules`

**Interfaces:**
- Produces: Firestore security rules allowing read and write access to `supplements`, `supplementCourses`, and `supplementCoursePdfTokens`.

- [ ] **Step 1: Delegate rules update to firestore-rules-author subagent**
Invoke `firestore-rules-author` subagent with instructions to add rules for `supplements`, `supplementCourses`, and `supplementCoursePdfTokens` matching the permissive access rules of existing collections in `firestore.rules`.

- [ ] **Step 2: Verify firestore.rules contains the new collection rules**
Run: `grep -E "supplements|supplementCourses|supplementCoursePdfTokens" firestore.rules`
Expected: Rules for all 3 collections present.

- [ ] **Step 3: Commit**
```bash
git add firestore.rules
git commit -m "chore(rules): add firestore security rules for supplement collections"
```

---

### Task 2: Data Migration Script from Neon to Firestore

**Files:**
- Create: `scripts/migrate-supplements-to-firestore.ts`
- Test: `scripts/migrate-supplements-to-firestore.ts`

**Interfaces:**
- Consumes: `@neondatabase/serverless` using `DATABASE_URL` from `.env`, Firestore `db` from `src/firebase.ts`.
- Produces: Populated `supplements` and `supplementCourses` collections in Cloud Firestore containing all 45 products and 11 historical courses with their item arrays.

- [ ] **Step 1: Write migration script**
Create `scripts/migrate-supplements-to-firestore.ts`:
```typescript
import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore';

const envText = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envText.match(/DATABASE_URL=([^\r\n]+)/);
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: "AIzaSyBKLSIGyGCXu0IhLzUgRHVXrgHkVv-55FU",
  authDomain: "fitjourneythailand.firebaseapp.com",
  projectId: "fitjourneythailand",
  storageBucket: "fitjourneythailand.firebasestorage.app",
  messagingSenderId: "971236941563",
  appId: "1:971236941563:web:cb44dfbd76f7b1fed6da5e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const sql = neon(dbUrlMatch[1]);

async function migrate() {
  console.log('--- Starting Migration from Neon to Firestore ---');

  // 1. Fetch supplements
  const supplements = await sql`SELECT * FROM supplements`;
  console.log(`Found ${supplements.length} supplements in Neon.`);

  const suppBatch = writeBatch(db);
  for (const s of supplements) {
    const ref = doc(db, 'supplements', s.id);
    suppBatch.set(ref, {
      id: s.id,
      name: s.name,
      imageUrl: s.image_url,
      price: Number(s.price),
      contentQuantity: Number(s.content_quantity),
      contentUnit: s.content_unit,
      isActive: Boolean(s.is_active),
      createdBy: s.created_by,
      updatedBy: s.updated_by,
      archivedBy: s.archived_by || null,
      createdAt: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
      updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
      archivedAt: s.archived_at ? new Date(s.archived_at).toISOString() : null,
    });
  }
  await suppBatch.commit();
  console.log(`✅ Successfully wrote ${supplements.length} supplements to Firestore.`);

  // 2. Fetch courses and items
  const courses = await sql`SELECT * FROM supplement_courses ORDER BY created_at ASC`;
  const items = await sql`SELECT * FROM supplement_course_items ORDER BY sort_order ASC`;
  console.log(`Found ${courses.length} courses and ${items.length} items in Neon.`);

  const itemsByCourseId = new Map<string, any[]>();
  for (const item of items) {
    const list = itemsByCourseId.get(item.course_id) || [];
    list.push({
      id: item.id,
      supplementId: item.supplement_id,
      supplementName: item.supplement_name,
      imageUrl: item.image_url,
      contentQuantity: Number(item.content_quantity),
      contentUnit: item.content_unit,
      unitPrice: Number(item.unit_price),
      packageQuantity: Number(item.package_quantity),
      discountType: item.discount_type,
      discountValue: Number(item.discount_value),
      grossAmount: Number(item.gross_amount),
      discountAmount: Number(item.discount_amount),
      netAmount: Number(item.net_amount),
      sortOrder: Number(item.sort_order),
    });
    itemsByCourseId.set(item.course_id, list);
  }

  const courseBatch = writeBatch(db);
  for (const c of courses) {
    const ref = doc(db, 'supplementCourses', c.id);
    const courseItems = itemsByCourseId.get(c.id) || [];
    courseBatch.set(ref, {
      id: c.id,
      trainerId: c.trainer_id,
      trainerName: c.trainer_name,
      traineeId: c.trainee_id,
      traineeName: c.trainee_name,
      subtotal: Number(c.subtotal),
      discountTotal: Number(c.discount_total),
      total: Number(c.total),
      cashbackPercent: Number(c.cashback_percent || 0),
      cashbackAmount: Number(c.cashback_amount || 0),
      items: courseItems,
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
      updatedAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
    });
  }
  await courseBatch.commit();
  console.log(`✅ Successfully wrote ${courses.length} courses to Firestore.`);
  console.log('--- Migration Finished Successfully ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run migration script and verify counts**
Run: `node --import tsx scripts/migrate-supplements-to-firestore.ts`
Expected: "Successfully wrote 45 supplements to Firestore" and "Successfully wrote 11 courses to Firestore".

- [ ] **Step 3: Commit**
```bash
git add scripts/migrate-supplements-to-firestore.ts
git commit -m "feat(migration): script and execution of neon supplements to firestore"
```

---

### Task 3: Client-Side Firestore Service Implementation

**Files:**
- Create: `src/services/supplementService.ts`
- Modify: `src/utils/api.ts:195-213`
- Test: `tests/supplement-firestore-service.test.ts`

**Interfaces:**
- Produces:
  - `supplementsFirestoreService`: CRUD methods directly querying Firestore (`supplements`, `supplementCourses`, `supplementCoursePdfTokens`).
  - `supplementsApi` & `supplementCoursesApi` updated in `src/utils/api.ts` to forward to `supplementsFirestoreService`.

- [ ] **Step 1: Write failing test for Firestore service helper logic**
Create `tests/supplement-firestore-service.test.ts`:
```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPdfToken, isPdfTokenExpired } from '../src/features/supplements/tokenUtils.ts';

test('tokenUtils hashes token using sha256', () => {
  const hash = hashPdfToken('test-token-123');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
});

test('tokenUtils detects expired token correctly', () => {
  const expiredDate = new Date(Date.now() - 1000).toISOString();
  const futureDate = new Date(Date.now() + 60000).toISOString();
  assert.equal(isPdfTokenExpired(expiredDate), true);
  assert.equal(isPdfTokenExpired(futureDate), false);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --import tsx --test tests/supplement-firestore-service.test.ts`
Expected: FAIL (cannot find module `tokenUtils.ts`)

- [ ] **Step 3: Implement `src/features/supplements/tokenUtils.ts`**
Create `src/features/supplements/tokenUtils.ts`:
```typescript
export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hashPdfTokenSync(rawToken: string): string {
  // Sync fallback for node environments
  const cryptoModule = (globalThis as any).crypto;
  if (!cryptoModule?.subtle) {
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(rawToken).digest('hex');
  }
  return '';
}

export function isPdfTokenExpired(expiresAt: string | Date, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
```

- [ ] **Step 4: Implement `src/services/supplementService.ts`**
Create `src/services/supplementService.ts` utilizing Firestore SDK:
```typescript
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
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateCourseCashback, calculateCourseLine, CASHBACK_PERCENTAGES } from '../features/supplements/pricing';
import type { DiscountType, Supplement, SavedSupplementCourse } from '../features/supplements/types';
import { isPdfTokenExpired, sha256Hex } from '../features/supplements/tokenUtils';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
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
    const now = new Date().toISOString();
    const docData: any = {
      id,
      name: String(data.name || '').trim(),
      imageUrl: String(data.imageUrl || '').trim(),
      price: Number(data.price || 0),
      contentQuantity: Number(data.contentQuantity || 1),
      contentUnit: data.contentUnit || 'เม็ด',
      isActive: true,
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
    const updateData: any = {
      name: String(data.name || '').trim(),
      imageUrl: String(data.imageUrl || '').trim(),
      price: Number(data.price || 0),
      contentQuantity: Number(data.contentQuantity || 1),
      contentUnit: data.contentUnit || 'เม็ด',
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(ref, updateData);
    return { id, ...snap.data(), ...updateData } as Supplement;
  },

  async archiveSupplement(id: string): Promise<{ id: string; archived: boolean }> {
    const ref = doc(db, 'supplements', id);
    await updateDoc(ref, {
      isActive: false,
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
      list.push(d.data() as SavedSupplementCourse);
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getCourse(id: string): Promise<SavedSupplementCourse> {
    const ref = doc(db, 'supplementCourses', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('ไม่พบประวัติคอร์ส');
    return snap.data() as SavedSupplementCourse;
  },

  async saveCourse(courseData: any, existingId?: string): Promise<SavedSupplementCourse> {
    const id = existingId || generateId();
    const now = new Date().toISOString();
    const cashbackPercent = Number(courseData.cashbackPercent || 0);

    const items = (courseData.items || []).map((line: any, idx: number) => {
      const unitPrice = Number(line.unitPrice || line.supplement?.price || 0);
      const packageQuantity = Number(line.packageQuantity || 1);
      const discountType = (line.discountType || 'none') as DiscountType;
      const discountValue = Number(line.discountValue || 0);
      const priced = calculateCourseLine(unitPrice, packageQuantity, discountType, discountValue);

      return {
        id: line.id || generateId(),
        supplementId: line.supplementId || line.supplement?.id,
        supplementName: line.supplementName || line.supplement?.name,
        imageUrl: line.imageUrl || line.supplement?.imageUrl || '',
        contentQuantity: Number(line.contentQuantity || line.supplement?.contentQuantity || 1),
        contentUnit: line.contentUnit || line.supplement?.contentUnit || 'เม็ด',
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

    const courseDoc: SavedSupplementCourse = {
      id,
      trainerId: courseData.trainerId || '',
      trainerName: courseData.trainerName || '',
      traineeId: courseData.traineeId || '',
      traineeName: courseData.traineeName || '',
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
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
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

  async getByPdfToken(rawToken: string): Promise<SavedSupplementCourse> {
    const tokenHash = await sha256Hex(rawToken);
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
```

- [ ] **Step 5: Connect `supplementsApi` and `supplementCoursesApi` in `src/utils/api.ts`**
Update `src/utils/api.ts` to call `supplementService` directly so that all UI components get Firestore integration seamlessly.

- [ ] **Step 6: Run tests and verify**
Run: `node --import tsx --test tests/supplement-firestore-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src/services/supplementService.ts src/features/supplements/tokenUtils.ts src/utils/api.ts tests/supplement-firestore-service.test.ts
git commit -m "feat(supplements): client-side firestore service for catalog and courses"
```

---

### Task 4: Verification of UI Flows & Legacy Tests

**Files:**
- Modify: `tests/supplement-course-delete.test.ts`, `tests/supplement-pdf-route.test.ts`
- Test: All tests in `tests/supplement-*.test.ts`

- [ ] **Step 1: Run all supplement test suites**
Run: `node --import tsx --test tests/supplement-*.test.ts`
Review failing tests (e.g. tests that had hardcoded regex assertions on legacy Vercel handlers).

- [ ] **Step 2: Update regex assertions in tests that check Vercel api methods**
Update tests that specifically checked HTTP endpoints so they verify the Firestore service contract instead.

- [ ] **Step 3: Re-run tests**
Run: `node --import tsx --test tests/supplement-*.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Commit**
```bash
git add tests/
git commit -m "test(supplements): align tests with firestore architecture"
```

---

### Task 5: Cleanup Serverless Endpoints & Build Verification

**Files:**
- Modify: `vercel.json` (remove supplement rewrites)
- Modify: `api/supplement-courses.ts` (deprecate or remove)
- Build: `npm run build`

- [ ] **Step 1: Clean up `vercel.json`**
Remove `{ "source": "/api/supplements", "destination": "/api/supplement-courses?resource=catalog" }` from `vercel.json`.

- [ ] **Step 2: Run production build**
Run: `npm run build`
Expected: Build succeeds with 0 TypeScript and bundling errors.

- [ ] **Step 3: Commit**
```bash
git add vercel.json api/
git commit -m "chore(cleanup): remove legacy neon supplement handlers and clean vercel config"
```
