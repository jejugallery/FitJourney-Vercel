# Duplicate Supplement Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers add the same supplement repeatedly as independent course lines.

**Architecture:** Give each client line its own generated `lineId`, while retaining `supplementId` as the product reference. The API validates unique catalog IDs but prices and saves every submitted line independently.

**Tech Stack:** TypeScript 6, Node test runner, React 19, Vercel Functions.

---

### Task 1: Failing Duplicate-Line Tests

**Files:**
- Create: `tests/supplement-duplicate-lines.test.ts`
- Create: `src/features/supplements/draftLines.ts`
- Create: `api/_supplement-course-lines.ts`

- [ ] Test that two draft lines for one supplement have different `lineId` values.
- [ ] Test that API catalog validation extracts one unique ID from two submitted duplicate lines without rejecting either line.
- [ ] Run tests and confirm the missing helpers fail.

### Task 2: Independent Client Lines

**Files:**
- Modify: `src/features/supplements/types.ts`
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Modify: `src/features/supplements/draftLines.ts`

- [ ] Add required `lineId` to `CourseDraftLine` and a draft-line factory.
- [ ] Keep every active product visible in the picker.
- [ ] Use `lineId` for React keys, updates, quantity, discount, and removal.
- [ ] Keep the API payload unchanged except that duplicate rows may repeat `supplementId`.

### Task 3: Backend Duplicate Acceptance

**Files:**
- Modify: `api/supplement-courses.ts`
- Modify: `api/_supplement-course-lines.ts`

- [ ] Remove the duplicate rejection and use unique IDs only for catalog loading.
- [ ] Preserve original draft-line order when calculating and saving items.
- [ ] Run duplicate tests, pricing tests, API TypeScript check, and production build.
- [ ] Commit the approved change on `main`.
