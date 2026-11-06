# Design Spec: Migrate Supplement System from Neon to Cloud Firestore

## 1. Overview
This project migrates the **Supplement Catalog and Course Planning System** (`supplements`, `supplement_courses`, `supplement_course_items`, and PDF sharing tokens) from **Neon PostgreSQL** to **Google Cloud Firestore**. 

The goal is to align with the rest of the FitJourney application architecture (such as `bodyMetrics`, `foodLogs`, `trainers`, `trainees`), eliminate Vercel serverless function cold starts and timeouts, enable real-time/instant queries via the Firebase Client SDK directly in the browser, and migrate all 45 existing supplement products and 11 historical courses seamlessly without data loss.

---

## 2. Firestore Data Models

### 2.1 Collection: `supplements`
Replaces the relational table `supplements`.
- **Document ID**: Unique string (retains the existing Neon hex/UUID ID to maintain backward compatibility with previous course item references).
- **Fields**:
  - `name`: `string` - Product title
  - `imageUrl`: `string` - Image HTTPS URL
  - `price`: `number` - Product price in Baht (allows `0` for free / member application forms)
  - `contentQuantity`: `number` - Number of items per pack/bottle
  - `contentUnit`: `'เม็ด' | 'ช้อน' | 'ซอง' | 'ใบ' | 'ชิ้น'` - Measurement unit
  - `isActive`: `boolean` - `true` if active in catalog, `false` if archived
  - `createdBy`: `string` - Trainer userId
  - `updatedBy`: `string` - Trainer userId
  - `createdAt`: `string` (ISO timestamp) or Firestore Timestamp
  - `updatedAt`: `string` (ISO timestamp) or Firestore Timestamp
  - `archivedBy` (optional): `string | null`
  - `archivedAt` (optional): `string | null`

### 2.2 Collection: `supplementCourses`
Replaces `supplement_courses` and `supplement_course_items`. In Firestore NoSQL, items are embedded directly in the course document as an array, eliminating expensive multi-table JOINs and cascading deletes.
- **Document ID**: Unique string (retains existing course ID or random hex/UUID).
- **Fields**:
  - `trainerId`: `string` - LINE User ID of the trainer who designed the course
  - `trainerName`: `string` - Display name of the trainer
  - `traineeId`: `string` - LINE User ID of the trainee
  - `traineeName`: `string` - Display name / nickname of the trainee
  - `subtotal`: `number` - Gross sum before discounts
  - `discountTotal`: `number` - Total discount amount
  - `total`: `number` - Final net payment amount
  - `cashbackPercent`: `number` - Approved cashback percentage (0, 3, 6, 9, 12, 15, 18, 21)
  - `cashbackAmount`: `number` - Calculated cashback reward
  - `createdAt`: `string` (ISO timestamp) or Firestore Timestamp
  - `updatedAt`: `string` (ISO timestamp) or Firestore Timestamp
  - `items`: `Array<CourseItem>` (Ordered by `sortOrder`):
    - `id`: `string`
    - `supplementId`: `string`
    - `supplementName`: `string`
    - `imageUrl`: `string`
    - `contentQuantity`: `number`
    - `contentUnit`: `string`
    - `unitPrice`: `number`
    - `packageQuantity`: `number`
    - `discountType`: `'none' | 'percent_10' | 'percent_15' | 'fixed_100' | 'fixed_300' | 'fixed_500' | 'custom'`
    - `discountValue`: `number`
    - `grossAmount`: `number`
    - `discountAmount`: `number`
    - `netAmount`: `number`
    - `sortOrder`: `number`

### 2.3 Collection: `supplementCoursePdfTokens`
Replaces `supplement_course_pdf_tokens` for short-lived (15 minutes) public sharing of course PDF/dashboard links.
- **Document ID**: `tokenHash` (SHA-256 hash of the generated random token).
- **Fields**:
  - `courseId`: `string` - Reference to document in `supplementCourses`
  - `createdAt`: `string` (ISO timestamp) or Firestore Timestamp
  - `expiresAt`: `string` (ISO timestamp) or Firestore Timestamp (expires after 15 minutes)

---

## 3. Architecture & Service Layer

### 3.1 Client-Side Service Implementation
Update `src/utils/api.ts` (or implement `src/services/supplementService.ts` and delegate `supplementsApi` / `supplementCoursesApi` to it):
- **`supplementsApi.list(includeArchived)`**:
  - If `includeArchived === true`, queries collection `supplements` ordered by `name ASC` (or in-memory sorting).
  - Otherwise, queries `where('isActive', '==', true)` and orders by name.
- **`supplementsApi.create(data)`**:
  - Validates fields via existing `_supplement-validation` logic (or equivalent client validation).
  - Inserts document into `supplements` with generated ID.
- **`supplementsApi.update(id, data)`**:
  - Updates document in `supplements`.
- **`supplementsApi.archive(id)`**:
  - Sets `isActive = false`, `archivedAt = now`, `archivedBy = currentUserId`.
- **`supplementCoursesApi.list(traineeId?)`**:
  - If `traineeId` is provided, queries `supplementCourses` where `traineeId == traineeId` ordered by `createdAt DESC`.
  - If not provided, retrieves courses for all linked trainees of the trainer (or by `trainerId == currentTrainerId`).
- **`supplementCoursesApi.get(id)`**:
  - Fetches single document from `supplementCourses`.
- **`supplementCoursesApi.create(data)` / `supplementCoursesApi.update(id, data)`**:
  - Calculates pricing & cashback using `pricing.ts` (`calculateCourseLine`, `calculateCourseCashback`).
  - Sets `items` array directly inside document.
  - Saves to `supplementCourses`.
- **`supplementCoursesApi.delete(id)`**:
  - Deletes document from `supplementCourses`.
- **`supplementCoursesApi.createPdfToken(courseId)` & `getByPdfToken(token)`**:
  - Hash token with SHA-256.
  - Save to `supplementCoursePdfTokens` with 15-minute expiry.
  - `getByPdfToken` hashes incoming token, checks `supplementCoursePdfTokens`, verifies expiration (`expiresAt > now`), then fetches the course document and returns it.

### 3.2 Security Rules (`firestore.rules`)
Firestore Security Rules will be updated via the mandatory `firestore-rules-author` subagent to declare:
- `supplements`: allow read and write (consistent with other app collections).
- `supplementCourses`: allow read and write.
- `supplementCoursePdfTokens`: allow read and write.

---

## 4. Neon Data Migration

A standalone migration script (`scripts/migrate-supplements-to-firestore.ts`) will:
1. Connect to Neon using `DATABASE_URL` via `@neondatabase/serverless`.
2. Connect to Firestore using Firebase client / admin SDK.
3. Query all 45 rows from `supplements` in Neon -> Batch write to `supplements` collection.
4. Query all 11 rows from `supplement_courses` and all associated items from `supplement_course_items` in Neon -> Group items into each course object -> Batch write to `supplementCourses` collection.
5. Log verification counts: confirm 45 supplements and 11 courses in Firestore.

---

## 5. Cleanup & Verification Plan

1. **Verification**:
   - Run unit tests (`node --import tsx --test tests/supplement-*.test.ts`) and adapt any tests asserting SQL/API behavior to test the Firestore service.
   - Run `npm run build` to guarantee zero TypeScript or bundle errors.
   - Test UI components:
     - Catalog panel: List, add, edit, archive supplements.
     - Course form: Select trainee, add items, set discounts, calculate cashback, save course.
     - Course history: View courses, view details, edit course, delete course.
     - PDF download / Dashboard link: Create token, open public link, download PDF.
2. **Cleanup**:
   - Remove obsolete Neon SQL handlers for supplements in `api/` (`_supplement-schema.ts`, `_supplements-handler.ts`, etc.) or mark deprecated.
   - Update `vercel.json` rewrites.
