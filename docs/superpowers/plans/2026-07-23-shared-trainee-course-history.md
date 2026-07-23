# Shared Trainee Supplement Course History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let linked co-trainers view and download every supplement course belonging to their shared trainees.

**Architecture:** Query Firestore server-side for trainee documents whose `trainerIds` array contains the current trainer ID. Use the resulting trainee IDs as the single authorization boundary for history listing, detail lookup, and PDF-token issuance while leaving course creation and attribution unchanged.

**Tech Stack:** TypeScript, Vercel Functions, Firestore REST API, Neon PostgreSQL, Node test runner

## Global Constraints

- Shared access is read/PDF only.
- Firestore `trainerIds` is authoritative.
- Removing a trainer revokes access on the next API request.
- Original course creator fields remain unchanged.

---

### Task 1: Resolve linked trainee IDs

**Files:**
- Create: `api/_linked-trainees.ts`
- Create: `tests/supplement-shared-history.test.ts`

**Interfaces:**
- Produces: `getLinkedTraineeIds(actorId: string): Promise<string[]>`.

- [ ] **Step 1: Write a failing source/behavior test**

Assert the helper uses a Firestore `ARRAY_CONTAINS` filter on `trainerIds`, extracts each trainee `userId`, removes empty values, and is exported.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-shared-history.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement linked-ID lookup**

POST a structured Firestore query against `trainees`, parse returned documents, and return unique nonempty `userId` values.

- [ ] **Step 4: Run and verify GREEN**

Run the shared-history test and expect the helper assertions to pass.

### Task 2: Shared list and detail access

**Files:**
- Modify: `api/supplement-courses.ts`
- Modify: `tests/supplement-shared-history.test.ts`

**Interfaces:**
- Consumes: `getLinkedTraineeIds(actor.userId)`.

- [ ] **Step 1: Add failing authorization assertions**

Assert list queries use linked trainee IDs, filtered list still calls `requireLinkedTrainee`, and detail no longer requires `trainer_id = actor.userId`.

- [ ] **Step 2: Implement unfiltered list**

Serialize linked trainee IDs and query `supplement_courses.trainee_id` through `jsonb_array_elements_text`. Return an empty list when no trainees are linked.

- [ ] **Step 3: Implement filtered list and detail**

Keep filtered trainee authorization. For detail, load the course by ID, then call `requireLinkedTrainee(actor.userId, course.trainee_id)` before returning items.

- [ ] **Step 4: Run and verify GREEN**

Run shared-history tests and API TypeScript checking.

### Task 3: Shared PDF-token issuance

**Files:**
- Modify: `api/supplement-courses.ts`
- Modify: `tests/supplement-shared-history.test.ts`

**Interfaces:**
- Reuses: `requireLinkedTrainee(actor.userId, course.trainee_id)`.

- [ ] **Step 1: Add a failing PDF authorization assertion**

Assert token issuance loads the course by ID without creator filtering and verifies the course trainee link before inserting a token.

- [ ] **Step 2: Implement shared token access**

Load `id, trainee_id`, deny missing courses, verify the linked trainee, then issue the existing 15-minute token.

- [ ] **Step 3: Run and verify GREEN**

Run shared-history and existing PDF API tests.

### Task 4: Full verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-shared-trainee-course-history.md`

- [ ] **Step 1: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/supplement-*.test.ts tests/course-trainee-dropdown.test.ts`

- [ ] **Step 2: Run API TypeScript and production build**

Run the established API TypeScript command and `npm run build`.

- [ ] **Step 3: Commit and push main**

Stage only `_linked-trainees.ts`, `supplement-courses.ts`, the affected PDF API test, the shared-history test, and this plan. Commit as `feat: share trainee supplement history` and push `origin main`.
