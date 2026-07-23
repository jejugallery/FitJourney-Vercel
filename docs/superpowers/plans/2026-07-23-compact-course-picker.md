# Compact Course Cards and Multi-Add Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selected supplement cards compact and keep the product picker open for repeated additions with visible selected counts.

**Architecture:** Derive selected counts from draft lines through a pure helper and keep picker navigation state independent from line additions. Add scoped responsive CSS classes for compact controls without changing history or catalog card layouts.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner

## Global Constraints

- Every add tap creates a separate draft line.
- Adding does not close the picker.
- Selected counts always derive from current draft lines.
- Mobile controls retain usable tap targets and never overflow horizontally.

---

### Task 1: Selected-count behavior

**Files:**
- Modify: `src/features/supplements/draftLines.ts`
- Modify: `tests/supplement-duplicate-lines.test.ts`

**Interfaces:**
- Produces: `countDraftLinesBySupplement(lines: CourseDraftLine[]): Record<string, number>`.

- [ ] **Step 1: Write a failing count test**

Create three independent lines containing two copies of one supplement and one copy of another. Assert counts are `{ a: 2, b: 1 }`.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-duplicate-lines.test.ts`

Expected: FAIL because the count helper does not exist.

- [ ] **Step 3: Implement the pure helper**

Reduce draft lines into a supplement-ID count object without mutating the input.

- [ ] **Step 4: Run and verify GREEN**

Run the duplicate-line test and expect all cases to pass.

### Task 2: Persistent multi-add picker

**Files:**
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Create: `tests/supplement-picker-ui.test.ts`

**Interfaces:**
- Consumes: `countDraftLinesBySupplement`.

- [ ] **Step 1: Write a failing source regression test**

Assert the picker renders `เสร็จสิ้น` and `เลือกแล้ว ×`, and verify the `add` handler no longer calls `setPickerOpen(false)`.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-picker-ui.test.ts`

Expected: FAIL on the current close-after-add behavior.

- [ ] **Step 3: Implement multi-add UI**

Keep the picker open after appending a line, derive selected counts with `useMemo`, show `เลือกแล้ว ×N` badges, add accessible product labels, and add an always-visible `เสร็จสิ้น` header button that returns to the form.

- [ ] **Step 4: Run and verify GREEN**

Run the picker UI and duplicate-line tests; expect all cases to pass.

### Task 3: Compact selected cards

**Files:**
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Modify: `src/index.css`
- Modify: `tests/supplement-picker-ui.test.ts`

**Interfaces:**
- Adds scoped hooks: `supplement-course-card-compact`, `supplement-course-controls`, and `supplement-selected-badge`.

- [ ] **Step 1: Extend the failing UI test**

Assert the component uses the compact card/control hooks and CSS provides a two-column control layout with a narrow-screen wrapping rule.

- [ ] **Step 2: Implement compact markup and CSS**

Reduce only selected-card image/padding/gaps, place quantity and discount controls in one responsive grid row, keep stepper buttons at least 40px, and retain the compact three-column line summary.

- [ ] **Step 3: Run UI tests**

Run picker UI tests and expect all cases to pass.

### Task 4: Full verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-compact-course-picker.md`

- [ ] **Step 1: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/supplement-*.test.ts tests/course-trainee-dropdown.test.ts`

- [ ] **Step 2: Run TypeScript and build**

Run the API TypeScript check and `npm run build`.

Expected: both succeed; the existing large-chunk warning is acceptable.

- [ ] **Step 3: Commit and push main**

```bash
git add src/features/supplements/draftLines.ts src/features/supplements/SupplementCourseForm.tsx src/index.css tests/supplement-duplicate-lines.test.ts tests/supplement-picker-ui.test.ts docs/superpowers/plans/2026-07-23-compact-course-picker.md
git commit -m "feat: compact supplement course picker"
git push origin main
```
