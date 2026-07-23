# Supplement Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trainer-only supplement course workflow with a superadmin catalog, immutable Neon history, ImgBB images, per-line discounts, and downloadable Thai PDFs.

**Architecture:** Add normalized Neon tables and two Vercel API resources, reuse Firestore trainer/trainee records for authorization and ownership, and keep UI orchestration inside a focused modal opened from `MetricsForm`. Generate PDFs client-side from the authoritative saved course snapshot so immediate and historical downloads use identical data.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vercel Functions, Neon PostgreSQL, Firebase Firestore, LIFF, ImgBB, html2canvas, jsPDF.

## Global Constraints

- Only superadmins may create, edit, or archive catalog items.
- Approved trainers may create and read courses only for trainees linked through `trainees.trainerIds`.
- Courses remain trainer-only and are not added to the trainee dashboard.
- Product deletion is archival; historical snapshots remain unchanged.
- Discounts are applied independently per course line.
- The user explicitly requested that Codex neither add nor run tests; implementation is handed off for user testing.

---

### Task 1: Database Schema and Shared Domain Types

**Files:**
- Modify: `schema.sql`
- Create: `src/features/supplements/types.ts`
- Create: `src/features/supplements/pricing.ts`

**Interfaces:**
- Produces: `Supplement`, `DiscountType`, `CourseDraftLine`, `SavedSupplementCourse`, `calculateCourseLine`, and `calculateCourseTotals`.

- [ ] **Step 1: Add the three normalized tables and indexes**

Add `supplements`, `supplement_courses`, and `supplement_course_items` exactly as defined in the approved design, including checks, audit columns, snapshot fields, foreign key, and indexes on trainer/date and course/sort order.

- [ ] **Step 2: Add focused TypeScript domain types**

Define explicit camel-case request/response shapes and the union:

```ts
export type DiscountType = 'none' | 'percent_10' | 'percent_15' | 'fixed_100' | 'fixed_500' | 'custom';
```

- [ ] **Step 3: Add pure pricing functions**

Use integer satang internally to avoid floating-point drift, cap discounts at gross, and return two-decimal baht values for the UI and API payloads.

### Task 2: LIFF-Backed API Authorization

**Files:**
- Create: `api/_auth.ts`
- Modify: `src/utils/api.ts`

**Interfaces:**
- Produces: `requireTrainer(req)`, `requireSuperadmin(req)`, `requireLinkedTrainee(actorId, traineeId)`, and an API client that attaches the current LIFF access token.

- [ ] **Step 1: Resolve the authenticated LINE subject**

Read `Authorization: Bearer <LIFF access token>`, verify the token with LINE, and reject missing, expired, or invalid tokens with HTTP 401.

- [ ] **Step 2: Resolve trainer role and trainee ownership**

Read the existing Firestore REST documents for `trainers` and `trainees`, require status `อนุมัติ` or `superadmin`, and require the actor ID in the selected trainee's `trainerIds`.

- [ ] **Step 3: Attach LIFF authorization in the frontend client**

Update the generic request wrapper to obtain `liff.getAccessToken()` and attach it without changing existing response camel-casing behavior.

### Task 3: Supplement Catalog API

**Files:**
- Create: `api/supplements.ts`
- Modify: `src/utils/api.ts`

**Interfaces:**
- Produces: `supplementsApi.list`, `create`, `update`, and `archive`.

- [ ] **Step 1: Implement catalog reads**

Allow approved trainers to read active products and allow superadmins to include archived products using `includeArchived=true`.

- [ ] **Step 2: Implement protected writes**

Validate name, ImgBB URL, positive price/content quantity, and one of `เม็ด|ช้อน|ซอง`; enforce superadmin status for POST, PUT, and DELETE.

- [ ] **Step 3: Implement archival semantics**

DELETE updates `is_active`, `archived_by`, `archived_at`, `updated_by`, and `updated_at` without removing the row.

### Task 4: Supplement Course API

**Files:**
- Create: `api/supplement-courses.ts`
- Modify: `src/utils/api.ts`

**Interfaces:**
- Consumes: pricing rules from the domain contract.
- Produces: `supplementCoursesApi.list`, `get`, and `create`.

- [ ] **Step 1: Implement owned history reads**

Return only rows whose `trainer_id` is the authenticated actor, optionally filter by an owned trainee, and return ordered line items for course details.

- [ ] **Step 2: Validate and price course creation**

Confirm trainee ownership, load every requested active product, reject duplicate/invalid items, recalculate gross/discount/net values from current prices, and snapshot trainer/trainee/product fields.

- [ ] **Step 3: Save atomically**

Use a Neon SQL transaction to insert the course and all items as one unit, then return the complete saved course snapshot.

### Task 5: PDF Generator

**Files:**
- Create: `src/features/supplements/coursePdf.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `downloadSupplementCoursePdf(course: SavedSupplementCourse): Promise<void>`.

- [ ] **Step 1: Add PDF rendering dependencies**

Install `html2canvas` and `jspdf` with npm so the lockfile records exact versions.

- [ ] **Step 2: Build a stable A4 document element**

Render FitJourney branding, Thai trainer/trainee/date labels, product image/name/content/quantity/price/discount/net rows, and totals in a temporary off-screen element.

- [ ] **Step 3: Render and download**

Capture with `html2canvas({ useCORS: true, scale: 2 })`, paginate the image into A4 pages with jsPDF, sanitize the trainee name, save the specified filename, and always remove the temporary element.

### Task 6: Supplement Course Modal

**Files:**
- Create: `src/components/SupplementCourseModal.tsx`
- Create: `src/features/supplements/SupplementCatalogPanel.tsx`
- Create: `src/features/supplements/SupplementCourseForm.tsx`
- Create: `src/features/supplements/SupplementCourseHistory.tsx`

**Interfaces:**
- Consumes: authenticated trainer ID/name, linked trainee list, supplement APIs, pricing helpers, ImgBB helper, and PDF downloader.
- Produces: `SupplementCourseModal({ onClose, trainer, trainees, isSuperadmin })`.

- [ ] **Step 1: Build the responsive modal shell and tabs**

Lock page scrolling, expose course/history tabs to trainers, expose catalog only to superadmins, and show loading/error/retry states.

- [ ] **Step 2: Build course composition**

Require a trainee, add/remove catalog lines, edit positive integer package quantities, support all discount options including conditional custom baht, and display live subtotal/discount/total.

- [ ] **Step 3: Save and download**

Prevent duplicate submits, call the course API, refresh history, download from the saved response, and keep the saved course available with a retry download action if PDF rendering fails.

- [ ] **Step 4: Build owned history**

Filter by linked trainee, show newest-first summaries, open snapshot details, and re-download PDFs.

- [ ] **Step 5: Build superadmin catalog management**

Create/edit products, validate the form, upload changed images with `uploadToImgBB`, retain unchanged edit images, confirm archival, and refresh active catalog data.

### Task 7: Trainer Card Integration

**Files:**
- Modify: `src/components/MetricsForm.tsx`

**Interfaces:**
- Consumes: `SupplementCourseModal` and existing profile/admin/trainee state.

- [ ] **Step 1: Add the entry button**

Place "จัดคอร์ส" in the existing Trainer card without removing the trainer-name edit action.

- [ ] **Step 2: Wire modal data**

Pass the current trainer snapshot, `trainees` already loaded by `MetricsForm`, and `reactiveAdminData.status === 'superadmin'`; close by unmounting the modal.

- [ ] **Step 3: Review the implementation diff**

Inspect the final diff for accidental unrelated changes, exposed secrets, inconsistent API names, and missing requirements. Do not run tests, lint, or builds per the user's explicit instruction.
