# Supplement Course Detail Price and Quantity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show saved course items as unit price multiplied by quantity and hide zero discounts.

**Architecture:** Add a pure display formatter for the price-quantity label, then apply conditional rendering in the existing course detail component. No API, schema, calculation, or PDF changes are required.

**Tech Stack:** React 19, TypeScript, Node test runner

## Global Constraints

- Changes apply only to saved course details.
- Zero discount text and the zero total-discount row are hidden.
- PDF output remains unchanged.

---

### Task 1: Price-quantity formatter

**Files:**
- Create: `src/features/supplements/courseDetailDisplay.ts`
- Create: `tests/supplement-course-detail.test.ts`

**Interfaces:**
- Produces: `formatCourseItemPriceQuantity(unitPrice: number, packageQuantity: number): string`.

- [ ] **Step 1: Write failing formatter tests**

Assert `1000, 2` returns `฿1,000.00 × 2` and `0, 1` returns `ฟรี × 1`.

- [ ] **Step 2: Run and verify RED**

Run the course-detail test and expect failure because the helper does not exist.

- [ ] **Step 3: Implement the formatter**

Reuse Thai number formatting and return `ฟรี` for zero.

- [ ] **Step 4: Run and verify GREEN**

Run the formatter tests and expect all cases to pass.

### Task 2: Conditional detail rendering

**Files:**
- Modify: `src/features/supplements/SupplementCourseHistory.tsx`
- Modify: `tests/supplement-course-detail.test.ts`

**Interfaces:**
- Consumes: `formatCourseItemPriceQuantity`.

- [ ] **Step 1: Add failing source assertions**

Assert detail items use the formatter, package contents no longer append purchased quantity, item discount checks `discountAmount > 0`, and the total discount row checks `discountTotal > 0`.

- [ ] **Step 2: Update detail markup**

Render package contents, formatted price × quantity, optional item discount, net amount, and optional total-discount row.

- [ ] **Step 3: Run and verify GREEN**

Run the course-detail test and expect all cases to pass.

### Task 3: Verify and deliver

- [ ] **Step 1: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/supplement-*.test.ts tests/course-trainee-dropdown.test.ts`

- [ ] **Step 2: Run production build**

Run: `npm run build`

- [ ] **Step 3: Commit and push main**

Stage the formatter, history component, test, and plan. Commit as `feat: clarify course detail pricing` and push `origin main`.
