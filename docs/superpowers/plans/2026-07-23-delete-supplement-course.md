# Delete Supplement Course History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow only the original course creator to permanently delete a supplement course from its detail view.

**Architecture:** Add creator-scoped DELETE behavior to the existing supplement-courses function and pass the current trainer ID through the modal into history rendering. Neon foreign-key cascades remove child items and PDF tokens atomically.

**Tech Stack:** React 19, TypeScript, Vercel Functions, Neon PostgreSQL, Node test runner

## Global Constraints

- Only the exact `trainer_id` creator may delete.
- Deletion is permanent and unrecoverable.
- Shared trainers never see the delete button.
- No new Serverless Function is added.

---

### Task 1: Creator-only DELETE API

**Files:**
- Modify: `api/supplement-courses.ts`
- Modify: `src/utils/api.ts`
- Create: `tests/supplement-course-delete.test.ts`

**Interfaces:**
- `DELETE /api/supplement-courses?id=courseId`.
- Frontend method: `supplementCoursesApi.delete(courseId)`.

- [ ] **Step 1: Write failing API assertions**

Assert DELETE uses `WHERE id = courseId AND trainer_id = actor.userId`, returns 404 when no row is deleted, and the CORS method list includes DELETE.

- [ ] **Step 2: Run and verify RED**

Run the delete test and expect failure.

- [ ] **Step 3: Implement DELETE**

Delete and return the course ID in one query. Return 404 for missing/non-owned courses and 200 for success.

- [ ] **Step 4: Add frontend API method and verify GREEN**

Run the delete test and API TypeScript checking.

### Task 2: Pass current trainer identity

**Files:**
- Modify: `src/components/MetricsForm.tsx`
- Modify: `src/components/SupplementCourseModal.tsx`
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`
- Modify: `tests/supplement-course-delete.test.ts`

**Interfaces:**
- Adds `currentTrainerId: string` prop from MetricsForm to modal to history.

- [ ] **Step 1: Add failing prop-flow assertions**

Assert all three components pass `currentTrainerId` and history compares it with `active.trainerId`.

- [ ] **Step 2: Implement prop flow**

Pass the current LIFF profile user ID down without deriving identity from course data.

- [ ] **Step 3: Run and verify GREEN**

Run the delete test and production type checking.

### Task 3: Permanent-delete UI

**Files:**
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`
- Modify: `tests/supplement-course-delete.test.ts`

**Interfaces:**
- Uses `window.confirm` with trainee name and permanent-delete warning.

- [ ] **Step 1: Add failing UI assertions**

Assert creator-only rendering, confirmation copy, loading state, API deletion, active-detail closure, and refresh trigger.

- [ ] **Step 2: Implement deletion**

Confirm, disable while deleting, call API, close detail, increment a local reload key, and alert success. Keep detail open on errors.

- [ ] **Step 3: Run and verify GREEN**

Run delete and all supplement tests.

### Task 4: Full verification and delivery

- [ ] **Step 1: Run all supplement tests**
- [ ] **Step 2: Run API TypeScript and production build**
- [ ] **Step 3: Commit and push main**

Stage only affected source, tests, and this plan. Commit as `feat: delete creator-owned supplement courses` and push `origin main`.
