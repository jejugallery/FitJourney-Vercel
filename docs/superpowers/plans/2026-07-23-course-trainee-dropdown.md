# Course Trainee Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native course trainee select with a searchable avatar dropdown matching the body-metrics form.

**Architecture:** Keep selection state in `SupplementCourseForm`, extract search filtering into a pure helper, and use feature-specific dropdown classes for trigger, overlay, panel, search, and options.

**Tech Stack:** React 19, TypeScript 6, Node test runner, CSS.

---

### Task 1: Trainee Search Test

**Files:**
- Create: `tests/course-trainee-dropdown.test.ts`
- Create: `src/features/supplements/traineeSearch.ts`

- [ ] Write a failing test for case-insensitive nickname search and empty-query behavior.
- [ ] Implement the minimal pure search helper and pass the test.

### Task 2: Custom Dropdown

**Files:**
- Modify: `src/features/supplements/SupplementCourseForm.tsx`

- [ ] Add open/search state and selected-trainee lookup.
- [ ] Replace native select with avatar trigger, rotating chevron, outside-click overlay, sticky search, options, highlighting, and empty states.
- [ ] Keep the existing `traineeId` save payload unchanged.

### Task 3: Styling and Verification

**Files:**
- Modify: `src/index.css`

- [ ] Add mobile-first dropdown classes with 44-pixel option targets and anchored panel scrolling.
- [ ] Run trainee search tests, existing supplement tests, API TypeScript check, and production build.
- [ ] Commit the approved change on `main`.
