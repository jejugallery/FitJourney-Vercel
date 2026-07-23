# External Supplement Course PDF Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save courses without downloading and provide reliable PDF downloads through a 15-minute external-browser link from course details.

**Architecture:** Reuse the supplement-courses function for authenticated token issuance and public token lookup. Add a public React route outside LIFF initialization that loads the tokenized course and invokes the existing PDF generator only from an explicit browser button.

**Tech Stack:** React 19, React Router, TypeScript, LINE LIFF, Vercel Functions, Neon PostgreSQL, jsPDF

## Global Constraints

- Token lifetime is exactly 15 minutes.
- Store only SHA-256 token hashes.
- Public PDF route must not initialize LIFF.
- No new Serverless Function may be added.
- Course form never downloads a PDF.

---

### Task 1: Token primitives and schema

**Files:**
- Create: `api/_supplement-pdf-token.ts`
- Create: `tests/supplement-pdf-token.test.ts`
- Modify: `api/_supplement-schema.ts`
- Modify: `schema.sql`

**Interfaces:**
- Produces: `createPdfToken(now?: Date): { rawToken: string; tokenHash: string; expiresAt: Date }`.
- Produces: `hashPdfToken(rawToken: string): string`.
- Produces: `isPdfTokenExpired(expiresAt: Date | string, now?: Date): boolean`.

- [ ] **Step 1: Write failing token tests**

Assert tokens have at least 64 hex characters, hashes are deterministic, expiration is exactly 15 minutes, and expiration boundary behavior is correct.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-pdf-token.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement token primitives**

Use `crypto.randomBytes(32)`, SHA-256, and a `15 * 60 * 1000` lifetime.

- [ ] **Step 4: Add token table**

Create `supplement_course_pdf_tokens` with `token_hash` primary key, course foreign key, timestamps, and an expiration index in runtime and standalone schemas.

- [ ] **Step 5: Run and verify GREEN**

Run the token tests and expect all cases to pass.

### Task 2: Token issue and public lookup API

**Files:**
- Modify: `api/supplement-courses.ts`
- Modify: `src/utils/api.ts`

**Interfaces:**
- `POST /api/supplement-courses?action=pdf-token` body `{ courseId }` returns `{ token, expiresAt }`.
- `GET /api/supplement-courses?pdfToken=...` returns a saved course snapshot without LINE authorization.
- Frontend methods: `createPdfToken(courseId)` and `getByPdfToken(token)`.

- [ ] **Step 1: Add API source regression tests**

Verify public lookup appears before `requireTrainer`, token creation checks trainer ownership, and responses include `Cache-Control: no-store`.

- [ ] **Step 2: Implement public lookup**

Hash the provided token, join token/course records, enforce `expires_at > CURRENT_TIMESTAMP`, load saved items, and return 404 for invalid or expired tokens.

- [ ] **Step 3: Implement authenticated issuance**

Verify the course belongs to the trainer, delete expired tokens, insert the new hash and expiration, then return the raw token and expiration.

- [ ] **Step 4: Add frontend API methods and type-check**

Run the API TypeScript check and expect exit code 0.

### Task 3: Public external PDF page

**Files:**
- Create: `src/pages/SupplementCoursePdfPage.tsx`
- Modify: `src/App.tsx`
- Create: `tests/supplement-pdf-route.test.ts`

**Interfaces:**
- Public route: `/supplement-course-pdf?token=...`.

- [ ] **Step 1: Write a failing route-isolation test**

Assert the PDF route is rendered outside `LiffProvider` and the page includes an explicit `ดาวน์โหลด PDF` action.

- [ ] **Step 2: Run and verify RED**

Run the route test and expect failure.

- [ ] **Step 3: Implement route isolation**

Place `BrowserRouter` outside the provider. Route `/supplement-course-pdf` directly to the public page and wrap all other routes in `LiffProvider`.

- [ ] **Step 4: Implement the public page**

Load the tokenized course, normalize numeric fields, show loading/error/expired states, and call `downloadSupplementCoursePdf(course)` only from the download button.

- [ ] **Step 5: Run and verify GREEN**

Run the route test and production TypeScript build.

### Task 4: Course save and external-open flow

**Files:**
- Modify: `src/components/SupplementCourseModal.tsx`
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`
- Create: `src/features/supplements/openCoursePdf.ts`
- Create: `tests/supplement-pdf-flow.test.ts`

**Interfaces:**
- Produces: `openCoursePdfExternal(courseId: string): Promise<void>`.

- [ ] **Step 1: Write failing flow tests**

Assert the form button says `บันทึก`, the modal save callback does not invoke PDF generation, and history uses the external-open helper.

- [ ] **Step 2: Implement save-only behavior**

Remove PDF import/call from the modal save callback and change the form button label.

- [ ] **Step 3: Implement external open**

Request a token, build the public URL, use `liff.openWindow({ external: true })` when available, and fall back to `window.open(url, '_blank', 'noopener,noreferrer')`.

- [ ] **Step 4: Update history detail**

Replace direct PDF generation with the external helper and show an error if token creation or window opening fails.

- [ ] **Step 5: Run and verify GREEN**

Run flow tests and expect all cases to pass.

### Task 5: Full verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-external-course-pdf.md`

- [ ] **Step 1: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/supplement-*.test.ts tests/course-trainee-dropdown.test.ts`

- [ ] **Step 2: Run API TypeScript and production build**

Run the established API TypeScript command and `npm run build`.

- [ ] **Step 3: Commit and push main**

Stage only the source, schema, tests, and plan files. Commit as `feat: add external course PDF downloads` and push `origin main`.
