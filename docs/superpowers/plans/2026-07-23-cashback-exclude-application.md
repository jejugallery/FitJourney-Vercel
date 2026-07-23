# Cashback Application Exclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude supplement lines whose names contain `ใบสมัคร` from cashback and add a 0% cashback option.

**Architecture:** Add pure pricing helpers that identify cashback-eligible product names and calculate cashback from eligible line net amounts. Add a pure stable PDF-ordering helper, then reuse these helpers in the React preview, Vercel API, and PDF generation while retaining existing persisted percentage and amount fields.

**Tech Stack:** React 19, TypeScript, Node test runner, Vercel Functions, Neon PostgreSQL

## Global Constraints

- Application-form lines still count toward trainee payment totals.
- Cashback options are exactly 0, 3, 6, 9, 12, 15, 18, and 21.
- Hide cashback displays whenever the calculated amount is zero.
- New course default remains 3%.
- PDF order is application forms first, paid normal products second, and free non-application products last.

---

### Task 1: Pure cashback eligibility and calculation

**Files:**
- Modify: `src/features/supplements/pricing.ts`
- Modify: `tests/supplement-pricing.test.ts`

**Interfaces:**
- Produces: `isCashbackEligibleName(name: string): boolean`.
- Produces: `calculateCourseCashback(lines: Array<{ name: string; netAmount: number }>, percent: number): number`.

- [ ] **Step 1: Write failing tests**

Test that normal items are eligible, names containing `ใบสมัคร` are ineligible, mixed lines calculate only from eligible net amounts, application-only lines return 0, and `CASHBACK_PERCENTAGES` includes 0 first.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-pricing.test.ts`

Expected: FAIL because helpers and the 0 option do not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Use `String(name).includes('ใบสมัคร')` for exclusion. Sum nonnegative eligible net amounts and pass that base to the existing satang-safe `calculateCashback`.

- [ ] **Step 4: Run and verify GREEN**

Run the pricing test and expect all cases to pass.

### Task 2: Integrate form and API

**Files:**
- Modify: `src/features/supplements/SupplementCourseForm.tsx`
- Modify: `api/supplement-courses.ts`

**Interfaces:**
- Consumes: `calculateCourseCashback` and `CASHBACK_PERCENTAGES`.

- [ ] **Step 1: Update the form preview**

Build cashback inputs from draft lines using each supplement name and `calculateCourseLine(...).netAmount`. Hide the cashback row unless `cashbackAmount > 0`; keep the dropdown visible.

- [ ] **Step 2: Update authoritative API calculation**

Allow 0 in API validation. Calculate cashback from the priced item snapshots using `supplementName` and `netAmount`, rather than the full course total.

- [ ] **Step 3: Verify type checking**

Run the API TypeScript command and expect exit code 0.

### Task 3: Stable PDF item ordering

**Files:**
- Create: `src/features/supplements/pdfItemOrder.ts`
- Create: `tests/supplement-pdf-order.test.ts`
- Modify: `src/features/supplements/coursePdf.ts`

**Interfaces:**
- Produces: `orderSupplementItemsForPdf<T extends { supplementName: string; unitPrice: number }>(items: T[]): T[]`.

- [ ] **Step 1: Write failing ordering tests**

Test that application forms precede paid normal products, paid normal products precede free normal products, a free application form remains first, and relative order inside each group is stable.

- [ ] **Step 2: Run and verify RED**

Run: `node --experimental-strip-types --test tests/supplement-pdf-order.test.ts`

Expected: FAIL because `pdfItemOrder.ts` does not exist.

- [ ] **Step 3: Implement and integrate stable grouping**

Return a copied array sorted by group rank: name containing `ใบสมัคร` = 0, non-application with `unitPrice > 0` = 1, and remaining free products = 2. Map PDF rows from the ordered copy without changing `course.items`.

- [ ] **Step 4: Run and verify GREEN**

Run the PDF ordering test and expect all cases to pass.

### Task 4: History, PDF cashback display, and full verification

**Files:**
- Review: `src/features/supplements/SupplementCourseHistory.tsx`
- Modify: `src/features/supplements/coursePdf.ts`

**Interfaces:**
- Existing display condition `cashbackPercent > 0` is tightened to persisted `cashbackAmount > 0`.

- [ ] **Step 1: Apply zero-amount display rule**

Show cashback in history and PDF only when `Number(cashbackAmount) > 0`.

- [ ] **Step 2: Run all supplement tests**

Run: `node --experimental-strip-types --test tests/supplement-*.test.ts tests/course-trainee-dropdown.test.ts`

Expected: all tests pass.

- [ ] **Step 3: Run production verification**

Run the API TypeScript command and `npm run build`.

Expected: both succeed; existing large-chunk warning is acceptable.

- [ ] **Step 4: Commit and push main**

```bash
git add src/features/supplements/pricing.ts src/features/supplements/pdfItemOrder.ts src/features/supplements/SupplementCourseForm.tsx src/features/supplements/SupplementCourseHistory.tsx src/features/supplements/coursePdf.ts api/supplement-courses.ts tests/supplement-pricing.test.ts tests/supplement-pdf-order.test.ts docs/superpowers/plans/2026-07-23-cashback-exclude-application.md
git commit -m "feat: exclude applications from cashback"
git push origin main
```
